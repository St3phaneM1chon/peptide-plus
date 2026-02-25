export const dynamic = 'force-dynamic';

/**
 * Admin Media Management API
 * GET  - List media files with folder filter and pagination
 * POST - Upload media (handle file upload via FormData)
 *
 * IMP-003: TODO: Add antivirus scan (ClamAV or Azure Defender for Storage) on uploaded files
 * IMP-009: DONE: CSRF protection is handled via withAdminGuard + validateCsrf on mutation endpoints
 * IMP-011: TODO: Add automated tests (Jest/Vitest) for upload endpoints (path traversal, MIME bypass, size limits)
 * IMP-012: TODO: Implement video compression/transcoding (FFmpeg or Azure Media Services) for uploaded videos
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import path from 'path';
import { randomUUID, createHash } from 'crypto';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { storage } from '@/lib/storage';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

/**
 * SECURITY FIX: Sanitize folder path to prevent path traversal attacks.
 * Removes ".." sequences, disallowed characters, duplicate slashes,
 * and leading/trailing slashes.
 */
function sanitizeFolderPath(rawFolder: string): string {
  return rawFolder
    .replace(/\.\./g, '')                   // Remove path traversal sequences
    .replace(/[^a-zA-Z0-9_\-\/]/g, '')      // Allow only safe chars
    .replace(/\/+/g, '/')                    // Collapse duplicate slashes
    .replace(/^\/|\/$/g, '');                // Strip leading/trailing slashes
}

// SECURITY FIX (BE-SEC-12): Allowed MIME types with their magic byte signatures
// Validates that file content actually matches the declared MIME type
const ALLOWED_MIME_SIGNATURES: Record<string, { bytes: number[]; offset?: number }[]> = {
  'image/jpeg': [{ bytes: [0xFF, 0xD8, 0xFF] }],
  'image/png': [{ bytes: [0x89, 0x50, 0x4E, 0x47] }],
  'image/gif': [{ bytes: [0x47, 0x49, 0x46] }],
  'image/webp': [{ bytes: [0x52, 0x49, 0x46, 0x46] }], // RIFF header
  'application/pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  'video/mp4': [
    { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // 'ftyp' at byte 4
  ],
  'video/webm': [{ bytes: [0x1A, 0x45, 0xDF, 0xA3] }], // EBML header
  'image/svg+xml': [], // SVGs are text-based, validated separately
  // IMP-054: HEIC/HEIF support for iPhone photo uploads (ftyp box at offset 4)
  'image/heic': [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }],
  'image/heif': [{ bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }],
};

// Blocked extensions that could be dangerous even with correct MIME
const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.php', '.jsp', '.asp', '.aspx', '.cgi', '.pl', '.py', '.rb', '.js', '.html', '.htm', '.svg'];

/**
 * Validate that file content magic bytes match the declared MIME type.
 * Returns true if valid, false if content doesn't match MIME.
 */
function validateMagicBytes(buffer: Buffer, declaredMime: string): boolean {
  const signatures = ALLOWED_MIME_SIGNATURES[declaredMime];

  // If MIME type is not in our allowed list, reject
  if (!signatures) return false;

  // SVG files are XML text - skip magic byte check but they are blocked by extension check
  if (declaredMime === 'image/svg+xml') return false; // Block SVG uploads (XSS risk)

  // Check if any signature matches
  for (const sig of signatures) {
    const offset = sig.offset || 0;
    if (buffer.length < offset + sig.bytes.length) continue;

    let matches = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[offset + i] !== sig.bytes[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }

  return false;
}

// F44 FIX: Filter media by uploadedBy for non-owner users
// F49 FIX: Add rate limiting to upload endpoint
// GET /api/admin/medias - List media files (supports ?stats=true for aggregated counts)
export const GET = withAdminGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);

    // F52 FIX: Support ?stats=true to return aggregated counts in a single request
    // instead of the dashboard making 5 separate API calls
    if (searchParams.get('stats') === 'true') {
      // F44 FIX: scope stats to user's own media if not OWNER
      const statsWhere: Record<string, unknown> = {};
      if (session.user.role !== 'OWNER') {
        statsWhere.uploadedBy = session.user.id;
      }

      const [totalMedia, imageCount, videoFileCount, pdfCount] = await Promise.all([
        prisma.media.count({ where: statsWhere }),
        prisma.media.count({ where: { ...statsWhere, mimeType: { startsWith: 'image' } } }),
        prisma.media.count({ where: { ...statsWhere, mimeType: { startsWith: 'video' } } }),
        prisma.media.count({ where: { ...statsWhere, mimeType: { startsWith: 'application/pdf' } } }),
      ]);

      return NextResponse.json({
        totalMedia,
        imageCount,
        videoFileCount,
        pdfCount,
      });
    }

    const rawFolder = searchParams.get('folder');
    const folder = rawFolder ? sanitizeFolderPath(rawFolder) : null;
    const mimeType = searchParams.get('mimeType');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const skip = (page - 1) * limit;

    // IMP-031: Support sort parameter for flexible ordering (name, date, size, type)
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';
    const allowedSortFields = ['createdAt', 'originalName', 'size', 'mimeType', 'folder'];
    const orderField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const where: Record<string, unknown> = {};

    // F44 FIX: Non-OWNER users can only see their own media (multi-tenant scoping)
    if (session.user.role !== 'OWNER') {
      where.uploadedBy = session.user.id;
    }

    if (folder) where.folder = folder;
    if (mimeType) where.mimeType = { startsWith: mimeType };
    if (search) {
      where.OR = [
        { filename: { contains: search, mode: 'insensitive' } },
        { originalName: { contains: search, mode: 'insensitive' } },
        { alt: { contains: search, mode: 'insensitive' } },
      ];
    }

    // IMP-031: Use dynamic sort field and direction
    const [media, total] = await Promise.all([
      prisma.media.findMany({
        where,
        orderBy: { [orderField]: sortDir },
        skip,
        take: limit,
      }),
      prisma.media.count({ where }),
    ]);

    return NextResponse.json({
      media,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Admin medias GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// FIX: F50 - TODO: Add width/height Int? fields to Media model in schema.prisma and populate at upload with sharp metadata
// FIX: F56 - TODO: Add @@index([createdAt]) and @@index([originalName]) to Media model in schema.prisma
// FIX: F57 - TODO: Add @@index([title]) to Video model in schema.prisma for text search performance
// FIX: F96 - TODO: Accept per-file alt text (e.g. alt_0, alt_1 FormData fields) instead of single alt for batch
// IMP-007: TODO: Integrate image-optimizer.ts (sharp) in upload flow to auto-generate thumbnail/medium/large variants
//   - After upload, call sharp to resize image into THUMBNAIL_CONFIGS variants
//   - Store variant URLs alongside original in Media record (requires schema: variantsJson String?)
//   - Currently image-optimizer.ts is client-only; needs server-side sharp integration
// IMP-038: TODO: Extract image dimensions at upload with sharp metadata (width, height)
//   - Requires adding width/height Int? fields to Media model (same as F50)
//   - Use: const metadata = await sharp(buffer).metadata(); then metadata.width, metadata.height
// POST /api/admin/medias - Upload media file(s) via FormData
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    // F49 FIX: Rate limit uploads - 50 uploads per hour per user
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/admin/medias/upload', session.user.id);
    if (!rl.success) {
      return NextResponse.json(
        { error: rl.error!.message },
        { status: 429, headers: rl.headers }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const folder = sanitizeFolderPath((formData.get('folder') as string) || 'general');
    const alt = formData.get('alt') as string | null;

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // StorageService handles directory creation internally (local or Azure)
    const uploaded = [];
    // FIX: F80 - Collect per-file errors instead of returning on first invalid file
    const errors: { file: string; error: string }[] = [];

    for (const file of files) {
      if (!(file instanceof File)) continue;

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        errors.push({ file: file.name, error: `File exceeds maximum size of 10MB` });
        continue; // FIX: F80 - Skip invalid file, process remaining
      }

      // SECURITY FIX (BE-SEC-12): Block dangerous file extensions
      const ext = path.extname(file.name).toLowerCase();
      if (BLOCKED_EXTENSIONS.includes(ext)) {
        errors.push({ file: file.name, error: `File extension ${ext} is not allowed` });
        continue; // FIX: F80 - Skip invalid file, process remaining
      }

      // Read file content into buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // SECURITY FIX (BE-SEC-12): Validate magic bytes match declared MIME type
      if (!validateMagicBytes(buffer, file.type)) {
        errors.push({ file: file.name, error: `Content does not match declared type (${file.type}). Only JPEG, PNG, GIF, WebP, and PDF are allowed.` });
        continue; // FIX: F80 - Skip invalid file, process remaining
      }

      // Generate unique filename
      const uniqueName = `${randomUUID()}${ext}`;

      // IMP-033: Check for duplicate files before uploading (uses SHA-256 content hash)
      const contentHash = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
      const existingUrl = await storage.findDuplicate(contentHash, folder);
      if (existingUrl) {
        // Duplicate found - reuse existing file URL instead of re-uploading
        const media = await prisma.media.create({
          data: {
            filename: uniqueName,
            originalName: file.name,
            mimeType: file.type,
            size: file.size,
            url: existingUrl,
            alt: alt || null,
            folder,
            uploadedBy: session.user.id,
          },
        });
        uploaded.push(media);
        continue;
      }

      // FIX (F9): Use StorageService instead of local filesystem (persists on Azure)
      const uploadResult = await storage.upload(buffer, uniqueName, file.type, { folder });
      const url = uploadResult.url;

      // Save to database
      const media = await prisma.media.create({
        data: {
          filename: uniqueName,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          url,
          alt: alt || null,
          folder,
          uploadedBy: session.user.id,
        },
      });

      uploaded.push(media);
    }

    // FIX: F80 - If all files failed, return 400 with error report
    if (uploaded.length === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: 'All files failed validation', errors },
        { status: 400 }
      );
    }

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPLOAD_MEDIA',
      targetType: 'Media',
      targetId: uploaded[0]?.id || 'batch',
      newValue: { folder, count: uploaded.length, files: uploaded.map(m => m.originalName), skipped: errors.length },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    // FIX: F80 - Return both successful uploads and per-file error report
    return NextResponse.json(
      { media: uploaded, count: uploaded.length, ...(errors.length > 0 ? { errors } : {}) },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Admin medias POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

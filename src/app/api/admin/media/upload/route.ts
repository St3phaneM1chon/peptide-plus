export const dynamic = 'force-dynamic';

/**
 * Admin Media Upload API
 * POST - Upload a media file (images, PDFs, videos)
 * Uses withAdminGuard for auth + CSRF + rate limiting
 * Pattern based on reviews/upload/route.ts
 */

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { storage } from '@/lib/storage';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { scanFileForMalware } from '@/lib/malware-scanner';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

const ALLOWED_MIME_TYPES: Record<string, { maxSize: number; extensions: string[] }> = {
  'image/jpeg': { maxSize: MAX_IMAGE_SIZE, extensions: ['jpg', 'jpeg'] },
  'image/png': { maxSize: MAX_IMAGE_SIZE, extensions: ['png'] },
  'image/webp': { maxSize: MAX_IMAGE_SIZE, extensions: ['webp'] },
  'image/gif': { maxSize: MAX_IMAGE_SIZE, extensions: ['gif'] },
  'application/pdf': { maxSize: MAX_IMAGE_SIZE, extensions: ['pdf'] },
  'video/mp4': { maxSize: MAX_VIDEO_SIZE, extensions: ['mp4'] },
  'video/webm': { maxSize: MAX_VIDEO_SIZE, extensions: ['webm'] },
};

// Magic bytes signatures for file validation
const MAGIC_BYTES: { check: (buf: Buffer) => boolean; mimes: string[] }[] = [
  { check: (b) => b[0] === 0xFF && b[1] === 0xD8, mimes: ['image/jpeg'] },
  { check: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47, mimes: ['image/png'] },
  { check: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46, mimes: ['image/webp'] },
  { check: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38, mimes: ['image/gif'] },
  { check: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46, mimes: ['application/pdf'] },
  { check: (b) => b.length >= 8 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70, mimes: ['video/mp4'] },
  { check: (b) => b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3, mimes: ['video/webm'] },
];

export const POST = withAdminGuard(async (request, context) => {
  const session = context?.session;
  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type must be multipart/form-data' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    // Sanitize folder path to prevent path traversal
    const rawFolder = (formData.get('folder') as string) || 'media';
    const folder = rawFolder
      .replace(/\.\./g, '')
      .replace(/[^a-zA-Z0-9_\-\/]/g, '')
      .replace(/\/+/g, '/')
      .replace(/^\/|\/$/g, '') || 'media';

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate MIME type
    const mimeConfig = ALLOWED_MIME_TYPES[file.type];
    if (!mimeConfig) {
      return NextResponse.json(
        { error: `File type not allowed: ${file.type}. Allowed: ${Object.keys(ALLOWED_MIME_TYPES).join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > mimeConfig.maxSize) {
      const maxMB = Math.round(mimeConfig.maxSize / (1024 * 1024));
      return NextResponse.json(
        { error: `File exceeds maximum size of ${maxMB} MB` },
        { status: 400 }
      );
    }

    // Validate extension
    const rawExtension = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || '';
    if (!mimeConfig.extensions.includes(rawExtension)) {
      return NextResponse.json(
        { error: `Invalid file extension .${rawExtension} for type ${file.type}` },
        { status: 400 }
      );
    }

    // Read file bytes and validate magic bytes
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const header = buffer.subarray(0, 8);

    const matchedMagic = MAGIC_BYTES.find((m) => m.check(header));
    if (!matchedMagic || !matchedMagic.mimes.includes(file.type)) {
      return NextResponse.json(
        { error: 'File content does not match declared MIME type' },
        { status: 400 }
      );
    }

    // IMP-003: Malware scan (non-blocking if VIRUSTOTAL_API_KEY not configured)
    const scanResult = await scanFileForMalware(buffer, file.name);
    if (!scanResult.safe) {
      return NextResponse.json(
        { error: `File rejected: ${scanResult.threat || 'Malware detected'}` },
        { status: 400 }
      );
    }

    // Check storage quota
    const userId = session.user?.id;
    if (userId) {
      const quota = await storage.checkStorageQuota(userId, file.size);
      if (!quota.allowed) {
        return NextResponse.json(
          { error: 'Storage quota exceeded' },
          { status: 413 }
        );
      }
    }

    // Generate unique filename
    const { randomUUID } = await import('crypto');
    const timestamp = Date.now();
    const filename = `admin_${timestamp}_${randomUUID().slice(0, 8)}.${rawExtension}`;

    // Upload via storage service
    const result = await storage.upload(buffer, filename, file.type, { folder });

    // Track in Media table
    let mediaId: string | null = null;
    try {
      const media = await db.media.create({
        data: {
          filename,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          url: result.url,
          folder,
          uploadedBy: userId || null,
        },
      });
      mediaId = media.id;
    } catch (trackErr) {
      logger.warn('Failed to track uploaded media in DB', {
        filename,
        error: trackErr instanceof Error ? trackErr.message : String(trackErr),
      });
    }

    return NextResponse.json({
      url: result.url,
      mediaId,
      filename,
      size: file.size,
    }, { status: 201 });
  } catch (error) {
    logger.error('Admin media upload POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/media/presigned-url
 *
 * Generate a presigned URL for direct client-side upload to Azure Blob Storage.
 * This bypasses the server for the actual file transfer, reducing latency and
 * server load for large files.
 *
 * Request body:
 *   { filename: string, contentType: string, maxSizeBytes?: number }
 *
 * Response:
 *   { uploadUrl: string, blobUrl: string, blobPath: string, expiresAt: string }
 *
 * Authentication: Admin guard (EMPLOYEE or OWNER role required).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import path from 'path';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { storage } from '@/lib/storage';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'video/mp4',
  'video/webm',
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB default cap

const presignedUrlSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  folder: z.string().max(200).optional(),
  maxSizeBytes: z.number().int().positive().max(MAX_FILE_SIZE).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sanitize folder path to prevent path traversal. */
function sanitizeFolder(raw: string): string {
  return raw
    .replace(/\.\./g, '')
    .replace(/[^a-zA-Z0-9_\-\/]/g, '')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '');
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = presignedUrlSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { filename, contentType, folder: rawFolder, maxSizeBytes } = parsed.data;

    // Validate content type
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: `Content type "${contentType}" is not allowed. Allowed: ${[...ALLOWED_CONTENT_TYPES].join(', ')}` },
        { status: 400 }
      );
    }

    // Build blob path
    const sanitizedFolder = sanitizeFolder(rawFolder || 'general');
    const ext = path.extname(filename);
    const blobPath = `${sanitizedFolder}/${randomUUID()}${ext}`;

    // Generate presigned URL (15 min expiry)
    const expiresInMinutes = 15;
    const result = await storage.getPresignedUploadUrl(blobPath, contentType, expiresInMinutes);

    if (!result) {
      return NextResponse.json(
        { error: 'Presigned URLs require Azure Blob Storage. Not available in local dev mode.' },
        { status: 503 }
      );
    }

    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

    logger.info('[presigned-url] Generated presigned upload URL', {
      userId: session.user.id,
      blobPath,
      contentType,
      maxSizeBytes: maxSizeBytes || MAX_FILE_SIZE,
    });

    return NextResponse.json({
      uploadUrl: result.uploadUrl,
      blobUrl: result.blobUrl,
      blobPath,
      contentType,
      maxSizeBytes: maxSizeBytes || MAX_FILE_SIZE,
      expiresAt,
    });
  } catch (error) {
    logger.error('[presigned-url] Failed to generate presigned URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

export const dynamic = 'force-dynamic';
/**
 * API - Review Image Upload
 * POST: Upload images for reviews (max 3 images, 5MB each)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { storage } from '@/lib/storage';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGES = 3;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  try {
    // SECURITY (BE-SEC-15): CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // SECURITY: Rate limit image uploads - 10 per minute per user
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/reviews/upload', session.user.id);
    if (!rl.success) {
      return NextResponse.json(
        { error: rl.error!.message },
        { status: 429, headers: rl.headers }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('images') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    if (files.length > MAX_IMAGES) {
      return NextResponse.json({ error: `Maximum ${MAX_IMAGES} images allowed` }, { status: 400 });
    }

    const uploadedUrls: string[] = [];
    // F-019 FIX: Track uploaded files for orphan cleanup
    // Each uploaded file is recorded in the Media table with folder='reviews-pending'.
    // Once a review is successfully created (by the review creation endpoint),
    // these records should be updated to folder='reviews'.
    // A scheduled cron job can then clean up any 'reviews-pending' entries older than
    // 24 hours that were never associated with a review (orphan files).
    const uploadedMediaIds: string[] = [];

    for (const file of files) {
      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Only JPG, PNG, and WebP are allowed.` },
          { status: 400 }
        );
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds maximum size of 5MB` },
          { status: 400 }
        );
      }

      // Generate unique filename with sanitized extension
      const timestamp = Date.now();
      // FIX: F54 - Use crypto.randomUUID() instead of Math.random() for secure filename generation
      const { randomUUID } = await import('crypto');
      const rawExtension = file.name.split('.').pop() || '';
      const extension = rawExtension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg';
      // Only allow known image extensions
      if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
        return NextResponse.json(
          { error: `Invalid file extension: .${extension}` },
          { status: 400 }
        );
      }
      const filename = `review_${timestamp}_${randomUUID().slice(0, 8)}.${extension}`;

      // Convert file to buffer and validate magic bytes
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const header = buffer.subarray(0, 4);
      const isJpeg = header[0] === 0xFF && header[1] === 0xD8;
      const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
      const isWebp = header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46;
      if (!isJpeg && !isPng && !isWebp) {
        return NextResponse.json(
          { error: 'File content does not match an allowed image format' },
          { status: 400 }
        );
      }

      // FIX (F10): Use StorageService instead of local filesystem (persists on Azure)
      const result = await storage.upload(buffer, filename, file.type, { folder: 'reviews' });
      uploadedUrls.push(result.url);

      // F-019 FIX: Track uploaded file in Media table with 'reviews-pending' folder.
      // This enables a cron job to identify and clean orphan uploads that were never
      // linked to a review (e.g., user abandoned the form, or review creation failed).
      try {
        const media = await db.media.create({
          data: {
            filename,
            originalName: file.name,
            mimeType: file.type,
            size: file.size,
            url: result.url,
            folder: 'reviews-pending',
            uploadedBy: session.user.id,
          },
        });
        uploadedMediaIds.push(media.id);
      } catch (trackErr) {
        // Non-blocking: if tracking fails, the upload still succeeds
        logger.warn('F-019: Failed to track uploaded file for orphan cleanup', {
          filename,
          error: trackErr instanceof Error ? trackErr.message : String(trackErr),
        });
      }
    }

    return NextResponse.json({
      urls: uploadedUrls,
      // F-019 FIX: Return media IDs so the review creation endpoint can mark them as confirmed
      _mediaIds: uploadedMediaIds,
    });
  } catch (error) {
    logger.error('Error uploading review images', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to upload images' },
      { status: 500 }
    );
  }
}

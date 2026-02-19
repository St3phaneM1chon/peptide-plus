export const dynamic = 'force-dynamic';
/**
 * API - Review Image Upload
 * POST: Upload images for reviews (max 3 images, 5MB each)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { validateCsrf } from '@/lib/csrf-middleware';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

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

    const formData = await request.formData();
    const files = formData.getAll('images') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }

    if (files.length > MAX_IMAGES) {
      return NextResponse.json({ error: `Maximum ${MAX_IMAGES} images allowed` }, { status: 400 });
    }

    const uploadedUrls: string[] = [];

    // TODO: migrate to Azure Blob Storage - local filesystem writes do not persist on Azure App Service
    // Ensure upload directory exists
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'reviews');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

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
      const randomString = Math.random().toString(36).substring(2, 8);
      const rawExtension = file.name.split('.').pop() || '';
      const extension = rawExtension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg';
      // Only allow known image extensions
      if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
        return NextResponse.json(
          { error: `Invalid file extension: .${extension}` },
          { status: 400 }
        );
      }
      const filename = `review_${timestamp}_${randomString}.${extension}`;

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

      const filepath = join(uploadDir, filename);
      await writeFile(filepath, buffer);

      // Store the public URL
      uploadedUrls.push(`/uploads/reviews/${filename}`);
    }

    return NextResponse.json({ urls: uploadedUrls });
  } catch (error) {
    console.error('Error uploading review images:', error);
    return NextResponse.json(
      { error: 'Failed to upload images' },
      { status: 500 }
    );
  }
}

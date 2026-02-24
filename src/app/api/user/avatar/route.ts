export const dynamic = 'force-dynamic';

/**
 * API Avatar utilisateur
 * POST /api/user/avatar - Upload avatar
 * DELETE /api/user/avatar - Remove avatar
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { validateCsrf } from '@/lib/csrf-middleware';
import { db } from '@/lib/db';
import { storage } from '@/lib/storage';
import { logger } from '@/lib/logger';

// POST - Upload avatar
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('avatar') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP and GIF allowed.' },
        { status: 400 }
      );
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum 5MB.' }, { status: 400 });
    }

    // Magic bytes validation
    const buffer = Buffer.from(await file.arrayBuffer());
    const magicBytes = buffer.subarray(0, 4);
    const isJpeg = magicBytes[0] === 0xFF && magicBytes[1] === 0xD8;
    const isPng =
      magicBytes[0] === 0x89 &&
      magicBytes[1] === 0x50 &&
      magicBytes[2] === 0x4E &&
      magicBytes[3] === 0x47;
    const isWebp = buffer.length >= 12 && buffer.subarray(8, 12).toString() === 'WEBP';
    const isGif =
      magicBytes[0] === 0x47 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46;

    if (!isJpeg && !isPng && !isWebp && !isGif) {
      return NextResponse.json({ error: 'Invalid image file' }, { status: 400 });
    }

    // Upload via storage service
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `avatar-${session.user.id}-${Date.now()}.${ext}`;
    const result = await storage.upload(buffer, filename, file.type, { folder: 'avatars' });

    // Delete old avatar from storage if it exists
    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { image: true },
    });
    // FIX: F83 - Log old avatar deletion failure instead of silently ignoring
    if (currentUser?.image) {
      try {
        await storage.delete(currentUser.image);
      } catch (deleteErr) {
        logger.warn('FIX: F83 - Failed to delete old avatar, may be orphaned', { path: currentUser.image, error: deleteErr instanceof Error ? deleteErr.message : String(deleteErr) });
      }
    }

    // Update user in DB
    await db.user.update({
      where: { id: session.user.id },
      data: { image: result.url },
    });

    return NextResponse.json({ success: true, url: result.url });
  } catch (error) {
    logger.error('Avatar upload error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

// DELETE - Remove avatar
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    // Delete old avatar from storage if it exists
    const currentUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { image: true },
    });
    if (currentUser?.image) {
      try {
        await storage.delete(currentUser.image);
      } catch (error) {
        console.error('[UserAvatar] Failed to delete old avatar from storage (non-critical):', error);
      }
    }

    await db.user.update({
      where: { id: session.user.id },
      data: { image: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Avatar delete error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}

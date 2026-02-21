export const dynamic = 'force-dynamic';

/**
 * API Chat Image Upload
 * POST /api/chat/upload - Upload an image for chat messages
 */

import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    const conversationId = formData.get('conversationId') as string | null;

    if (!file || !conversationId) {
      return NextResponse.json({ error: 'File and conversationId required' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, WebP and GIF images allowed' }, { status: 400 });
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Magic bytes validation
    const magicBytes = buffer.subarray(0, 4);
    const isJpeg = magicBytes[0] === 0xFF && magicBytes[1] === 0xD8;
    const isPng = magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4E && magicBytes[3] === 0x47;
    const isWebp = buffer.length >= 12 && buffer.subarray(8, 12).toString() === 'WEBP';
    const isGif = magicBytes[0] === 0x47 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46;

    if (!isJpeg && !isPng && !isWebp && !isGif) {
      return NextResponse.json({ error: 'Invalid image file' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `chat-${conversationId}-${Date.now()}.${ext}`;
    const result = await storage.upload(buffer, filename, file.type, { folder: 'chat' });

    return NextResponse.json({
      success: true,
      url: result.url,
      name: file.name,
      size: file.size,
    });
  } catch (error) {
    console.error('Chat upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

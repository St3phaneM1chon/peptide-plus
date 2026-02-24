export const dynamic = 'force-dynamic';

/**
 * API Chat Image Upload
 * POST /api/chat/upload - Upload an image for chat messages
 */

import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { auth } from '@/lib/auth-config';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // SECURITY FIX (F-002 + F-007): Auth + rate limiting for chat upload
    const session = await auth();

    // Rate limit: 5 uploads per minute per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/chat/upload', session?.user?.id);
    if (!rl.success) {
      const res = NextResponse.json(
        { error: rl.error!.message },
        { status: 429 }
      );
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    const conversationId = formData.get('conversationId') as string | null;
    const visitorId = formData.get('visitorId') as string | null;

    if (!file || !conversationId) {
      return NextResponse.json({ error: 'File and conversationId required' }, { status: 400 });
    }

    // Require either an authenticated session or a valid visitorId
    if (!session?.user && !visitorId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify conversation access
    const conversation = await db.chatConversation.findUnique({
      where: { id: conversationId },
      select: { id: true, visitorId: true, userId: true },
    });
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    const isAdmin = session?.user && ['OWNER', 'EMPLOYEE'].includes(session.user.role as string);
    if (!isAdmin) {
      const matchesVisitor = visitorId && conversation.visitorId === visitorId;
      const matchesUser = session?.user?.id && conversation.userId === session.user.id;
      if (!matchesVisitor && !matchesUser) {
        return NextResponse.json({ error: 'Unauthorized access to conversation' }, { status: 403 });
      }
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

    // FIX F-028: Derive extension from magic bytes, not client-supplied filename
    const ext = isJpeg ? 'jpg' : isPng ? 'png' : isWebp ? 'webp' : 'gif';
    const filename = `chat-${conversationId}-${Date.now()}.${ext}`;
    const result = await storage.upload(buffer, filename, file.type, { folder: 'chat' });

    return NextResponse.json({
      success: true,
      url: result.url,
      name: file.name,
      size: file.size,
    });
  } catch (error) {
    logger.error('Chat upload error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

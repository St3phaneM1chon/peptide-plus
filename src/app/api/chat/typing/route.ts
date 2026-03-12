export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/typing - Broadcast typing indicator via Redis Pub/Sub
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { publishChatEvent } from '@/lib/chat/realtime';
import { validateBody } from '@/lib/api-validation';

const typingSchema = z.object({
  conversationId: z.string().min(1, 'conversationId is required').max(100),
  isTyping: z.boolean().optional().default(true),
}).strict();

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = validateBody(typingSchema, body);
    if (!validation.success) return validation.response;
    const { conversationId, isTyping } = validation.data;

    // Verify the user is a participant in this conversation
    const conversation = await db.chatConversation.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    });
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    if (conversation.userId !== session.user.id) {
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });
      if (user?.role !== 'OWNER' && user?.role !== 'EMPLOYEE') {
        return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
      }
    }

    await publishChatEvent({
      type: 'typing',
      conversationId,
      userId: session.user.id,
      userName: session.user.name || 'Admin',
      data: { isTyping: !!isTyping },
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

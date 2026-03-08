export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/typing - Broadcast typing indicator via Redis Pub/Sub
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { publishChatEvent } from '@/lib/chat/realtime';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { conversationId, isTyping } = await request.json();
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }

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

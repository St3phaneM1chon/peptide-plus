export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/read - Mark messages as read and broadcast read receipt
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { publishChatEvent } from '@/lib/chat/realtime';
import { logger } from '@/lib/logger';
import { validateBody } from '@/lib/api-validation';

const markReadSchema = z.object({
  conversationId: z.string().min(1, 'conversationId is required').max(100),
  messageIds: z.array(z.string().min(1).max(100)).max(500).optional(),
}).strict();

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = validateBody(markReadSchema, body);
    if (!validation.success) return validation.response;
    const { conversationId, messageIds } = validation.data;

    // Verify the user is a participant in this conversation
    const conversation = await db.chatConversation.findUnique({
      where: { id: conversationId },
      select: { userId: true, visitorId: true },
    });
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    // Allow if user is the assigned agent (userId) or an OWNER/EMPLOYEE
    if (conversation.userId !== session.user.id) {
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });
      if (user?.role !== 'OWNER' && user?.role !== 'EMPLOYEE') {
        return NextResponse.json({ error: 'Not a participant in this conversation' }, { status: 403 });
      }
    }

    // Build the where clause for marking messages as read
    const whereClause: {
      conversationId: string;
      isRead: boolean;
      id?: { in: string[] };
    } = {
      conversationId,
      isRead: false,
    };

    if (Array.isArray(messageIds) && messageIds.length > 0) {
      whereClause.id = { in: messageIds };
    }

    const result = await db.chatMessage.updateMany({
      where: whereClause,
      data: { isRead: true, readAt: new Date() },
    });

    // Publish read event via Redis Pub/Sub
    await publishChatEvent({
      type: 'read',
      conversationId,
      userId: session.user.id,
      data: {
        count: result.count,
        messageIds: messageIds || [],
      },
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (err) {
    logger.error('Mark read error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

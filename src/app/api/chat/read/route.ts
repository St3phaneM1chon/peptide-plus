export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/read - Mark messages as read and broadcast read receipt
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { publishChatEvent } from '@/lib/chat/realtime';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { conversationId, messageIds } = await request.json();
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
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

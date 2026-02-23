export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/chats/recent
 * Returns the last 24h of chat conversations with latest message per client.
 * Grouped by conversation, sorted by most recent first, limited to 20 entries.
 */
export const GET = withAdminGuard(async () => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Fetch conversations that have messages in the last 24h
    const conversations = await prisma.chatConversation.findMany({
      where: {
        lastMessageAt: { gte: since },
        // FIX F-040: Only show active/waiting conversations, not closed/archived
        status: { in: ['ACTIVE', 'WAITING_ADMIN'] },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 20,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            isRead: true,
            createdAt: true,
          },
        },
      },
    });

    const chats = conversations.map((conv) => {
      const lastMsg = conv.messages[0];
      // Count unread messages from visitor (not admin/bot)
      return {
        id: conv.id,
        clientName: conv.visitorName || conv.visitorEmail || `Visitor ${conv.visitorId.slice(0, 6)}`,
        clientId: conv.visitorId,
        lastMessage: lastMsg
          ? lastMsg.content.split('\n')[0].slice(0, 120)
          : '',
        lastMessageAt: conv.lastMessageAt.toISOString(),
        unreadCount: 0, // Will be filled below
      };
    });

    // Batch count unread messages per conversation
    if (chats.length > 0) {
      const unreadCounts = await prisma.chatMessage.groupBy({
        by: ['conversationId'],
        where: {
          conversationId: { in: chats.map((c) => c.id) },
          isRead: false,
          sender: 'VISITOR',
        },
        _count: { id: true },
      });

      const countMap = new Map(
        unreadCounts.map((uc) => [uc.conversationId, uc._count.id])
      );

      for (const chat of chats) {
        chat.unreadCount = countMap.get(chat.id) ?? 0;
      }
    }

    return NextResponse.json({ chats });
  } catch (error) {
    logger.error('Recent chats error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

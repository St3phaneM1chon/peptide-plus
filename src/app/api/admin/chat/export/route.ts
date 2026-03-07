export const dynamic = 'force-dynamic';

/**
 * Chat Export API
 * GET /api/admin/chat/export?conversationId=xxx&format=csv|json
 * Exports a chat conversation as CSV or JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  const { searchParams } = request.nextUrl;
  const conversationId = searchParams.get('conversationId');
  const format = searchParams.get('format') || 'csv';

  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
  }

  try {
    const conversation = await prisma.chatConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    if (format === 'json') {
      // JSON export
      const exportData = {
        conversation: {
          id: conversation.id,
          visitorId: conversation.visitorId,
          visitorName: conversation.visitorName,
          visitorEmail: conversation.visitorEmail,
          visitorLanguage: conversation.visitorLanguage,
          status: conversation.status,
          createdAt: conversation.createdAt.toISOString(),
          lastMessageAt: conversation.lastMessageAt.toISOString(),
        },
        messages: conversation.messages.map((m) => ({
          id: m.id,
          sender: m.sender,
          senderName: m.senderName,
          content: m.content,
          contentOriginal: m.contentOriginal,
          language: m.language,
          type: m.type,
          isFromBot: m.isFromBot,
          isRead: m.isRead,
          createdAt: m.createdAt.toISOString(),
        })),
        exportedAt: new Date().toISOString(),
        exportedBy: session.user.name || session.user.email,
      };

      return new Response(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="chat-${conversationId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      });
    }

    // CSV export (default)
    const BOM = '\uFEFF';
    const headers = ['Date', 'Time', 'Sender', 'Sender Name', 'Language', 'Type', 'Message', 'Original Message', 'Read'];
    const rows = conversation.messages.map((m) => {
      const date = new Date(m.createdAt);
      return [
        date.toISOString().slice(0, 10),
        date.toISOString().slice(11, 19),
        m.sender,
        m.senderName || '',
        m.language || '',
        m.type || 'TEXT',
        (m.content || '').replace(/"/g, '""'),
        (m.contentOriginal || '').replace(/"/g, '""'),
        m.isRead ? 'Yes' : 'No',
      ];
    });

    const csv = BOM + [headers, ...rows]
      .map((r) => r.map((v) => `"${v}"`).join(','))
      .join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="chat-${conversationId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    logger.error('[chat:export] Export error', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

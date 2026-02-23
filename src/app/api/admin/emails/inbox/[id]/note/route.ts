export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/emails/inbox/[id]/note
 * Add an internal note to a conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

export const POST = withAdminGuard(
  async (request: NextRequest, { session, params }: { session: { user: { id: string } }; params: { id: string } }) => {
    try {
      const { id: conversationId } = params;
      const body = await request.json();
      const { content, mentions } = body;

      if (!content || !content.trim()) {
        return NextResponse.json({ error: 'Note content is required' }, { status: 400 });
      }

      const conversation = await prisma.emailConversation.findUnique({
        where: { id: conversationId },
        select: { id: true },
      });

      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }

      const note = await prisma.conversationNote.create({
        data: {
          conversationId,
          authorId: session.user.id,
          content: content.trim(),
          mentions: mentions ? JSON.stringify(mentions) : null,
        },
        include: {
          author: { select: { id: true, name: true, email: true, image: true } },
        },
      });

      // Log activity
      await prisma.conversationActivity.create({
        data: {
          conversationId,
          actorId: session.user.id,
          action: 'noted',
          details: JSON.stringify({ noteId: note.id }),
        },
      });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'ADD_CONVERSATION_NOTE',
        targetType: 'ConversationNote',
        targetId: note.id,
        newValue: { conversationId, contentPreview: content.trim().substring(0, 200) },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch(() => {});

      return NextResponse.json({ note });
    } catch (error) {
      logger.error('[Note] Error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

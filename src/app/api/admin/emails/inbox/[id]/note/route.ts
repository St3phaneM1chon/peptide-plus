export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/emails/inbox/[id]/note
 * Add an internal note to a conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { logger } from '@/lib/logger';

const noteSchema = z.object({
  content: z.string().min(1).max(10000),
  mentions: z.array(z.string().uuid()).max(50).optional(),
});

export const POST = withAdminGuard(
  async (request: NextRequest, { session, params }: { session: { user: { id: string } }; params: { id: string } }) => {
    try {
      // Rate limiting
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip') || '127.0.0.1';
      const rl = await rateLimitMiddleware(ip, '/api/admin/emails/inbox/note');
      if (!rl.success) {
        const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
        Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
        return res;
      }
      // CSRF validation
      const csrfValid = await validateCsrf(request);
      if (!csrfValid) {
        return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
      }

      const { id: conversationId } = params;
      const body = await request.json();
      const parsed = noteSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
      }
      const { content, mentions } = parsed.data;

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
      }).catch((err: unknown) => { logger.error('[Note] Non-blocking audit log for note creation failed', { error: err instanceof Error ? err.message : String(err) }); });

      return NextResponse.json({ note });
    } catch (error) {
      logger.error('[Note] Error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

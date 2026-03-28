export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/emails/inbox/[id]/reply
 * Send a reply to a conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { sendEmail } from '@/lib/email/email-service';
import { generateUnsubscribeUrl } from '@/lib/email/unsubscribe';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { sanitizeText } from '@/lib/sanitize';
import { logger } from '@/lib/logger';

const replySchema = z.object({
  to: z.string().email().max(320),
  subject: z.string().min(1).max(998),
  htmlBody: z.string().min(1).max(512000),
  textBody: z.string().max(512000).optional(),
  scheduledFor: z.string().datetime().optional(),
});

export const POST = withAdminGuard(
  async (request: NextRequest, { session, params }: { session: { user: { id: string; name?: string; email?: string } }; params: { id: string } }) => {
    try {
      // Rate limiting
      const ip = getClientIpFromRequest(request);
      const rl = await rateLimitMiddleware(ip, '/api/admin/emails/inbox/reply');
      if (!rl.success) {
        const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
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
      const parsed = replySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
      }
      const { to, subject, htmlBody, textBody, scheduledFor } = parsed.data;

      // Security #13: Strip header injection characters from email
      const sanitizedTo = String(to).replace(/[\r\n]/g, '').trim();

      // COMM-F7 FIX: Sanitize HTML body to prevent XSS injection via admin reply.
      // Allow basic HTML structure but escape dangerous content within text nodes.
      // Remove script tags and event handlers that could execute in the recipient's client.
      const sanitizedHtmlBody = htmlBody
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/\bon\w+\s*=\s*[^\s>]*/gi, '')
        .replace(/javascript\s*:/gi, 'blocked:');
      const sanitizedTextBody = textBody ? sanitizeText(textBody) : null;

      // Security: validate scheduledFor date bounds
      if (scheduledFor) {
        const scheduledDate = new Date(scheduledFor);
        const now = new Date();
        if (scheduledDate.getTime() < now.getTime()) {
          return NextResponse.json({ error: 'scheduledFor cannot be in the past' }, { status: 400 });
        }
        const maxFuture = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days
        if (scheduledDate.getTime() > maxFuture.getTime()) {
          return NextResponse.json({ error: 'scheduledFor cannot be more than 90 days in the future' }, { status: 400 });
        }
      }

      const conversation = await prisma.emailConversation.findUnique({
        where: { id: conversationId },
        select: { id: true, status: true },
      });

      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }

      // Create outbound reply record
      const reply = await prisma.outboundReply.create({
        data: {
          conversationId,
          senderId: session.user.id,
          to: sanitizedTo,
          subject,
          htmlBody: sanitizedHtmlBody,
          textBody: sanitizedTextBody,
          status: scheduledFor ? 'scheduled' : 'sending',
          scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        },
      });

      // Send email if not scheduled
      if (!scheduledFor) {
        try {
          // Generate unsubscribe URL (CAN-SPAM / RGPD / LCAP compliance)
          const unsubscribeUrl = await generateUnsubscribeUrl(sanitizedTo, 'transactional').catch((err) => {
            logger.warn('[Reply] Failed to generate unsubscribe URL', { to: sanitizedTo, error: err instanceof Error ? err.message : String(err) });
            return undefined;
          });

          const result = await sendEmail({
            to: { email: sanitizedTo },
            subject,
            html: sanitizedHtmlBody,
            text: sanitizedTextBody || undefined,
            from: {
              email: process.env.SMTP_FROM || 'support@attitudes.vip',
              name: session.user.name || 'Attitudes VIP Support',
            },
            replyTo: process.env.SMTP_FROM || 'support@attitudes.vip',
            unsubscribeUrl,
          });

          await prisma.outboundReply.update({
            where: { id: reply.id },
            data: {
              status: result.success ? 'sent' : 'failed',
              sentAt: result.success ? new Date() : null,
            },
          });

          // Log in EmailLog for tracking
          await prisma.emailLog.create({
            data: {
              id: `reply-${reply.id}`,
              to: sanitizedTo,
              subject,
              status: result.success ? 'sent' : 'failed',
              error: result.error || null,
            },
          });
        } catch (sendError) {
          await prisma.outboundReply.update({
            where: { id: reply.id },
            data: { status: 'failed' },
          });
          logger.error('[Reply] Send error', { error: sendError instanceof Error ? sendError.message : String(sendError) });
        }
      }

      // Update conversation status to OPEN if it was NEW or PENDING
      if (['NEW', 'PENDING'].includes(conversation.status)) {
        await prisma.emailConversation.update({
          where: { id: conversationId },
          data: { status: 'OPEN' },
        });
      }

      // Update lastMessageAt
      await prisma.emailConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });

      // Log activity
      await prisma.conversationActivity.create({
        data: {
          conversationId,
          actorId: session.user.id,
          action: 'replied',
          details: JSON.stringify({ replyId: reply.id, to: sanitizedTo, subject }),
        },
      });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'REPLY_TO_CONVERSATION',
        targetType: 'OutboundReply',
        targetId: reply.id,
        newValue: { conversationId, to: sanitizedTo, subject },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch((auditErr) => {
        logger.warn('[Reply] Non-blocking audit log failure', { conversationId, replyId: reply.id, error: auditErr instanceof Error ? auditErr.message : String(auditErr) });
      });

      return NextResponse.json({ success: true, data: reply });
    } catch (error) {
      logger.error('[Reply] Error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

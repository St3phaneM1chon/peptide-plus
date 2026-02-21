export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/emails/inbox/[id]/reply
 * Send a reply to a conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { sendEmail } from '@/lib/email/email-service';
import { generateUnsubscribeUrl } from '@/lib/email/unsubscribe';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

export const POST = withAdminGuard(
  async (request: NextRequest, { session, params }: { session: { user: { id: string; name?: string; email?: string } }; params: { id: string } }) => {
    try {
      const { id: conversationId } = params;
      const body = await request.json();
      const { to, subject, htmlBody, textBody, scheduledFor } = body;

      if (!to || !subject || !htmlBody) {
        return NextResponse.json({ error: 'Missing required fields: to, subject, htmlBody' }, { status: 400 });
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
          to,
          subject,
          htmlBody,
          textBody: textBody || null,
          status: scheduledFor ? 'scheduled' : 'sending',
          scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        },
      });

      // Send email if not scheduled
      if (!scheduledFor) {
        try {
          // Generate unsubscribe URL (CAN-SPAM / RGPD / LCAP compliance)
          const unsubscribeUrl = await generateUnsubscribeUrl(to, 'transactional').catch(() => undefined);

          const result = await sendEmail({
            to: { email: to },
            subject,
            html: htmlBody,
            text: textBody,
            from: {
              email: process.env.SMTP_FROM || 'support@biocyclepeptides.com',
              name: session.user.name || 'BioCycle Support',
            },
            replyTo: process.env.SMTP_FROM || 'support@biocyclepeptides.com',
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
              to,
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
          console.error('[Reply] Send error:', sendError);
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
          details: JSON.stringify({ replyId: reply.id, to, subject }),
        },
      });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'REPLY_TO_CONVERSATION',
        targetType: 'OutboundReply',
        targetId: reply.id,
        newValue: { conversationId, to, subject },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch(() => {});

      return NextResponse.json({ success: true, data: reply });
    } catch (error) {
      console.error('[Reply] Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

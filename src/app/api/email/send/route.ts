export const dynamic = 'force-dynamic';

/**
 * Mobile Email Send API
 * POST /api/email/send — Send an email via Resend/SendGrid/SMTP
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withMobileGuard } from '@/lib/mobile-guard';
import { sendEmail } from '@/lib/email/email-service';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(998),
  body: z.string().min(1),
  bodyHtml: z.string().optional(),
  replyToId: z.string().optional(),
  fromAccount: z.string().email().optional(),
});

/**
 * POST — Send an email message.
 */
export const POST = withMobileGuard(async (request, { session }) => {
  try {
    const rawBody = await request.json();
    const parsed = sendEmailSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { to, subject, body, bodyHtml, replyToId, fromAccount } = parsed.data;

    // Determine sender
    const senderEmail = fromAccount || 'noreply@biocyclepeptides.com';
    const senderName = session.user.name || 'BioCycle Peptides';

    // Send via the email service (handles provider fallback, rate limiting, etc.)
    const result = await sendEmail({
      to: { email: to },
      subject,
      html: bodyHtml || `<div style="font-family: sans-serif; white-space: pre-wrap;">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`,
      text: body,
      from: { email: senderEmail, name: senderName },
      replyTo: senderEmail,
      emailType: 'transactional',
    });

    if (!result.success) {
      logger.error('[Email Send] Failed from mobile', {
        to,
        error: result.error,
        userId: session.user.id,
      });
      return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
    }

    // Save to email conversation for history
    try {
      let conversation;

      if (replyToId) {
        // If replying to an existing conversation, create outbound reply
        conversation = await prisma.emailConversation.findUnique({
          where: { id: replyToId },
        });
      }

      if (!conversation) {
        // Create a new email conversation
        conversation = await prisma.emailConversation.create({
          data: {
            subject,
            status: 'PENDING',
            priority: 'NORMAL',
            lastMessageAt: new Date(),
          },
        });
      }

      // Create outbound reply record
      await prisma.outboundReply.create({
        data: {
          conversationId: conversation.id,
          senderId: session.user.id,
          to,
          subject,
          htmlBody: bodyHtml || body,
          textBody: body,
          messageId: result.messageId || null,
          status: 'sent',
          sentAt: new Date(),
        },
      });
    } catch (dbError) {
      // Non-blocking: email was sent, DB save is best-effort
      logger.warn('[Email Send] DB save failed', {
        error: dbError instanceof Error ? dbError.message : String(dbError),
      });
    }

    logger.info('[Email Send] Email sent from mobile', {
      to,
      subject,
      userId: session.user.id,
      messageId: result.messageId,
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId || null,
    }, { status: 201 });
  } catch (error) {
    logger.error('[Email Send] POST failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
});

export const dynamic = 'force-dynamic';

/**
 * Inbound SMS Webhook
 * Receives incoming SMS from Telnyx and creates/updates InboxConversation records.
 * Enables 2-way SMS conversations in the CRM unified inbox.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const smsInboundSchema = z.object({
  data: z.object({
    event_type: z.string(),
    id: z.string().optional(),
    payload: z.object({
      from: z.object({ phone_number: z.string() }).optional(),
      to: z.array(z.object({ phone_number: z.string() })).optional(),
      text: z.string().optional(),
    }).passthrough(),
  }).passthrough(),
}).passthrough();

/**
 * Verify Telnyx webhook signature (HMAC-SHA256).
 * Same mechanism as the VoIP Telnyx webhook: sha256(timestamp + body).
 */
function verifyTelnyxSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  try {
    const expected = createHmac('sha256', secret)
      .update((timestamp || '') + rawBody)
      .digest('hex');
    if (signature.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify Telnyx webhook signature
    const signingSecret = process.env.TELNYX_WEBHOOK_SECRET;
    if (!signingSecret) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('[SMS Inbound] TELNYX_WEBHOOK_SECRET not configured in production');
        return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
      }
      logger.warn('[SMS Inbound] TELNYX_WEBHOOK_SECRET not set — skipping verification (dev mode)');
    } else {
      const signature = request.headers.get('telnyx-signature-ed25519')
        || request.headers.get('x-telnyx-signature');
      const timestamp = request.headers.get('telnyx-timestamp');

      if (!verifyTelnyxSignature(rawBody, signature, timestamp, signingSecret)) {
        logger.warn('[SMS Inbound] Invalid or missing Telnyx signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const rawParsed = JSON.parse(rawBody);
    const parsed = smsInboundSchema.safeParse(rawParsed);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const body = parsed.data;

    // Telnyx webhook format
    const event = body.data;
    if (!event || event.event_type !== 'message.received') {
      return NextResponse.json({ success: true }); // Acknowledge non-message events
    }

    const payload = event.payload;
    const fromPhone = payload.from?.phone_number;
    const toPhone = payload.to?.[0]?.phone_number;
    const messageText = payload.text;

    if (!fromPhone || !messageText) {
      return NextResponse.json({ success: true });
    }

    // Check for opt-out keywords
    const optOutKeywords = ['stop', 'unsubscribe', 'cancel', 'arret', 'arreter'];
    if (optOutKeywords.includes(messageText.trim().toLowerCase())) {
      // Handle opt-out
      await prisma.smsOptOut.upsert({
        where: { phone: fromPhone },
        create: { phone: fromPhone, reason: 'STOP keyword' },
        update: { reason: 'STOP keyword' },
      });

      logger.info('SMS opt-out received', { phone: fromPhone });
      return NextResponse.json({ success: true });
    }

    // Find lead by phone
    const lead = await prisma.crmLead.findFirst({
      where: {
        OR: [
          { phone: fromPhone },
          { phone: fromPhone.replace(/^\+1/, '') },
          { phone: `+1${fromPhone.replace(/^\+/, '')}` },
        ],
      },
      select: { id: true, contactName: true, assignedToId: true },
    });

    // Find or create inbox conversation
    let conversation = await prisma.inboxConversation.findFirst({
      where: {
        channel: 'SMS',
        status: { not: 'RESOLVED' },
        ...(lead ? { leadId: lead.id } : {}),
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (!conversation) {
      conversation = await prisma.inboxConversation.create({
        data: {
          channel: 'SMS',
          status: 'OPEN',
          subject: `SMS from ${lead?.contactName || fromPhone}`,
          leadId: lead?.id,
          assignedToId: lead?.assignedToId,
          lastMessageAt: new Date(),
        },
      });
    }

    // Create inbox message
    await prisma.inboxMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        content: messageText,
        senderName: lead?.contactName || fromPhone,
        senderPhone: fromPhone,
        metadata: {
          telnyxMessageId: event.id,
          toPhone,
        },
      },
    });

    // Update conversation
    await prisma.inboxConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status: 'OPEN' },
    });

    // Create CRM activity if lead found
    if (lead) {
      await prisma.crmActivity.create({
        data: {
          type: 'SMS',
          title: 'Inbound SMS received',
          description: messageText.slice(0, 500),
          leadId: lead.id,
          performedById: lead.assignedToId,
          metadata: {
            direction: 'inbound',
            fromPhone,
            conversationId: conversation.id,
          },
        },
      });

      // Update lead last contacted
      await prisma.crmLead.update({
        where: { id: lead.id },
        data: { lastContactedAt: new Date() },
      });
    }

    logger.info('Inbound SMS processed', {
      from: fromPhone,
      leadId: lead?.id,
      conversationId: conversation.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('SMS inbound webhook error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: true }); // Always 200 for webhooks to prevent retries
  }
}

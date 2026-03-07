export const dynamic = 'force-dynamic';

/**
 * Email-to-Lead Webhook
 * POST: Receives inbound emails (e.g., from Resend/SendGrid inbound parse).
 *       Parses sender email, checks if CrmLead exists. If not, auto-creates
 *       a lead with source='EMAIL'. Creates CrmActivity.
 *
 * This is a SEPARATE webhook from /api/webhooks/inbound-email (which handles
 * the email conversation system). This one focuses on lead creation/enrichment.
 *
 * NO auth guard - this is a webhook endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const emailInboundSchema = z.object({
  from: z.union([z.string(), z.object({ address: z.string(), name: z.string().optional() })]).optional(),
  From: z.union([z.string(), z.object({ address: z.string(), name: z.string().optional() })]).optional(),
  sender: z.string().optional(),
  envelope: z.object({ from: z.string().optional() }).optional(),
  data: z.object({ from: z.string().optional() }).optional(),
  subject: z.string().optional(),
  Subject: z.string().optional(),
  text: z.string().optional(),
  html: z.string().optional(),
  body: z.string().optional(),
  messageId: z.string().optional(),
  message_id: z.string().optional(),
  'Message-ID': z.string().optional(),
  fromName: z.string().optional(),
  from_name: z.string().optional(),
}).passthrough();

/**
 * Timing-safe comparison of webhook secret to prevent timing attacks.
 */
function verifyWebhookSecret(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET;
    if (!webhookSecret) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('[EmailToLead] EMAIL_WEBHOOK_SECRET not configured in production');
        return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
      }
      logger.warn('[EmailToLead] EMAIL_WEBHOOK_SECRET not set — skipping verification (dev mode)');
    } else {
      const providedSecret = request.headers.get('x-webhook-secret') || '';
      if (!providedSecret || !verifyWebhookSecret(providedSecret, webhookSecret)) {
        logger.warn('[EmailToLead] Invalid or missing x-webhook-secret header');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsedResult = emailInboundSchema.safeParse(rawBody);
    if (!parsedResult.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsedResult.error.flatten() }, { status: 400 });
    }

    const body: Record<string, any> = parsedResult.data;

    // Normalize the inbound email payload from various providers
    const senderEmail = extractSenderEmail(body);
    const senderName = extractSenderName(body);
    const subject = (body.subject || body.Subject || '') as string;
    const emailBody = (body.text || body.html || body.body || '') as string;
    const messageId =
      body.messageId ||
      body.message_id ||
      body['Message-ID'] ||
      `email_${Date.now()}`;

    if (!senderEmail) {
      logger.warn('[EmailToLead] No sender email found in payload');
      return NextResponse.json(
        { error: 'Missing sender email' },
        { status: 400 },
      );
    }

    // Check if a CrmLead already exists with this email
    let lead = await prisma.crmLead.findFirst({
      where: {
        email: { equals: senderEmail.toLowerCase(), mode: 'insensitive' },
      },
      select: {
        id: true,
        contactName: true,
        assignedToId: true,
      },
    });

    let isNewLead = false;

    if (!lead) {
      // Auto-create a new lead
      lead = await prisma.crmLead.create({
        data: {
          contactName: senderName || senderEmail.split('@')[0],
          email: senderEmail.toLowerCase(),
          source: 'EMAIL',
          status: 'NEW',
          score: 10, // Low initial score
          temperature: 'COLD',
          tags: ['auto-created', 'email-inbound'],
          lastContactedAt: new Date(),
        },
        select: {
          id: true,
          contactName: true,
          assignedToId: true,
        },
      });
      isNewLead = true;

      logger.info('[EmailToLead] New lead auto-created', {
        leadId: lead.id,
        email: senderEmail,
        name: senderName,
      });
    } else {
      // Update last contacted
      await prisma.crmLead.update({
        where: { id: lead.id },
        data: { lastContactedAt: new Date() },
      });
    }

    // Create CRM activity for the inbound email
    await prisma.crmActivity.create({
      data: {
        type: 'EMAIL',
        title: subject
          ? `Inbound email: ${subject.slice(0, 200)}`
          : 'Inbound email received',
        description: emailBody.slice(0, 1000),
        leadId: lead.id,
        performedById: lead.assignedToId,
        metadata: {
          direction: 'inbound',
          from: senderEmail,
          fromName: senderName,
          subject,
          messageId,
          isNewLead,
          source: 'email-to-lead-webhook',
        },
      },
    });

    // Create an InboxConversation if one doesn't already exist for this lead + email thread
    let conversation = await prisma.inboxConversation.findFirst({
      where: {
        channel: 'EMAIL',
        leadId: lead.id,
        status: { in: ['OPEN', 'PENDING'] },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    if (!conversation) {
      conversation = await prisma.inboxConversation.create({
        data: {
          channel: 'EMAIL',
          status: 'OPEN',
          subject: subject || `Email from ${senderName || senderEmail}`,
          leadId: lead.id,
          assignedToId: lead.assignedToId,
          lastMessageAt: new Date(),
        },
      });
    }

    // Create inbox message
    await prisma.inboxMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        content: emailBody.slice(0, 5000),
        senderName: senderName || senderEmail,
        senderEmail: senderEmail,
        metadata: {
          messageId,
          subject,
          source: 'email-to-lead-webhook',
        },
      },
    });

    // Update conversation timestamp
    await prisma.inboxConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status: 'OPEN' },
    });

    logger.info('[EmailToLead] Inbound email processed', {
      leadId: lead.id,
      isNewLead,
      email: senderEmail,
      conversationId: conversation.id,
    });

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      isNewLead,
      conversationId: conversation.id,
    });
  } catch (error) {
    logger.error('[EmailToLead] Webhook error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractSenderEmail(body: Record<string, any>): string {
  // Try various formats
  const rawFrom =
    body.from ||
    body.From ||
    body.sender ||
    body.envelope?.from ||
    (body.data && typeof body.data === 'object' ? body.data.from : null) ||
    '';

  if (typeof rawFrom === 'string') {
    // Extract email from "Name <email@domain.com>" format
    const match = rawFrom.match(/<([^>]+)>/);
    return (match ? match[1] : rawFrom).trim().toLowerCase();
  }

  if (typeof rawFrom === 'object' && rawFrom?.address) {
    return rawFrom.address.toLowerCase();
  }

  return '';
}

function extractSenderName(body: Record<string, any>): string | null {
  const rawFrom =
    body.from ||
    body.From ||
    (body.data && typeof body.data === 'object' ? body.data.from : null) ||
    '';

  if (typeof rawFrom === 'string') {
    const match = rawFrom.match(/^"?([^"<]+)"?\s*</);
    return match ? match[1].trim() : null;
  }

  if (typeof rawFrom === 'object' && rawFrom?.name) {
    return rawFrom.name;
  }

  return body.fromName || body.from_name || null;
}

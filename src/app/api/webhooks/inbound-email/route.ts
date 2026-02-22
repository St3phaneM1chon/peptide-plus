export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';

/**
 * POST /api/webhooks/inbound-email
 * Receives inbound emails from Resend (Svix) or SendGrid Inbound Parse.
 * Auth: Svix HMAC-SHA256 signature (Resend) or Bearer token fallback.
 * Uses INBOUND_EMAIL_WEBHOOK_SECRET if set, otherwise falls back to RESEND_WEBHOOK_SECRET.
 */

function verifyResendSignature(
  rawBody: string,
  headers: { svixId: string; svixTimestamp: string; svixSignature: string },
  secret: string,
): boolean {
  const secretBytes = Buffer.from(secret.replace('whsec_', ''), 'base64');
  const toSign = `${headers.svixId}.${headers.svixTimestamp}.${rawBody}`;
  const expectedSig = createHmac('sha256', secretBytes).update(toSign).digest('base64');

  const signatures = headers.svixSignature.split(' ');
  for (const sig of signatures) {
    const sigValue = sig.startsWith('v1,') ? sig.slice(3) : sig;
    try {
      if (timingSafeEqual(Buffer.from(expectedSig), Buffer.from(sigValue))) {
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    // Use dedicated secret or fall back to shared Resend webhook secret
    const webhookSecret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET || process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Webhook] No webhook secret configured (INBOUND_EMAIL_WEBHOOK_SECRET or RESEND_WEBHOOK_SECRET)');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    // Read raw body for signature verification
    const rawBody = await request.text();

    // Verify Svix signature (Resend format)
    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');

    if (svixId && svixTimestamp && svixSignature) {
      const ts = parseInt(svixTimestamp, 10);
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - ts) > 300) {
        return NextResponse.json({ error: 'Timestamp expired' }, { status: 401 });
      }
      if (!verifyResendSignature(rawBody, { svixId, svixTimestamp, svixSignature }, webhookSecret)) {
        console.warn('[Webhook] Invalid inbound email signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else {
      // No Svix headers — check Bearer token fallback
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${webhookSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody);

    // Normalize payload from different providers
    const payload = normalizePayload(body);

    if (!payload.from || !payload.messageId) {
      return NextResponse.json({ error: 'Missing required fields: from, messageId' }, { status: 400 });
    }

    // Deduplicate by messageId
    const existing = await prisma.inboundEmail.findUnique({
      where: { messageId: payload.messageId },
    });
    if (existing) {
      return NextResponse.json({ message: 'Duplicate email, already processed', id: existing.id });
    }

    // Find or create conversation by threading
    let conversationId: string | null = null;
    let isNewConversation = true;

    if (payload.inReplyTo) {
      const relatedEmail = await prisma.inboundEmail.findUnique({
        where: { messageId: payload.inReplyTo },
        select: { conversationId: true },
      });
      if (relatedEmail?.conversationId) {
        conversationId = relatedEmail.conversationId;
        isNewConversation = false;
      }
    }

    if (!conversationId && payload.references) {
      const refIds = payload.references.split(/\s+/).filter(Boolean);
      for (const refId of refIds) {
        const relatedEmail = await prisma.inboundEmail.findUnique({
          where: { messageId: refId },
          select: { conversationId: true },
        });
        if (relatedEmail?.conversationId) {
          conversationId = relatedEmail.conversationId;
          isNewConversation = false;
          break;
        }
      }
    }

    // Match customer by email
    const customer = await prisma.user.findFirst({
      where: { email: { equals: payload.from.toLowerCase(), mode: 'insensitive' } },
      select: { id: true, name: true, email: true },
    });

    // Create conversation if needed
    if (!conversationId) {
      const conversation = await prisma.emailConversation.create({
        data: {
          subject: payload.subject || '(No Subject)',
          customerId: customer?.id || null,
          status: 'NEW',
          priority: 'NORMAL',
        },
      });
      conversationId = conversation.id;
    } else {
      // Reopen if resolved/closed
      const convo = await prisma.emailConversation.findUnique({
        where: { id: conversationId },
        select: { status: true },
      });
      if (convo && (convo.status === 'RESOLVED' || convo.status === 'CLOSED')) {
        await prisma.emailConversation.update({
          where: { id: conversationId },
          data: { status: 'OPEN' },
        });
        await prisma.conversationActivity.create({
          data: {
            conversationId,
            action: 'status_changed',
            details: JSON.stringify({ from: convo.status, to: 'OPEN', reason: 'customer_replied' }),
          },
        });
      }
    }

    // Create inbound email
    const inboundEmail = await prisma.inboundEmail.create({
      data: {
        conversationId,
        from: payload.from,
        fromName: payload.fromName || null,
        to: payload.to || '',
        subject: payload.subject || '(No Subject)',
        htmlBody: payload.html || null,
        textBody: payload.text || null,
        messageId: payload.messageId,
        inReplyTo: payload.inReplyTo || null,
        references: payload.references || null,
        isSpam: (payload.spamScore || 0) > 5,
        spamScore: payload.spamScore || null,
      },
    });

    // Update conversation lastMessageAt
    await prisma.emailConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    // Log activity
    await prisma.conversationActivity.create({
      data: {
        conversationId,
        action: 'email_received',
        details: JSON.stringify({
          inboundEmailId: inboundEmail.id,
          from: payload.from,
          subject: payload.subject,
          isNew: isNewConversation,
        }),
      },
    });

    // Store attachments if any
    if (payload.attachments?.length) {
      for (const att of payload.attachments) {
        await prisma.inboundEmailAttachment.create({
          data: {
            inboundEmailId: inboundEmail.id,
            filename: att.filename || 'attachment',
            mimeType: att.contentType || 'application/octet-stream',
            size: att.size || 0,
            storageUrl: `pending://${inboundEmail.id}/${att.filename}`,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      id: inboundEmail.id,
      conversationId,
      isNewConversation,
    });
  } catch (error) {
    console.error('[Webhook] Inbound email error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

interface NormalizedPayload {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  messageId: string;
  inReplyTo?: string;
  references?: string;
  spamScore?: number;
  attachments?: Array<{ filename: string; contentType: string; size: number }>;
}

function normalizePayload(body: Record<string, unknown>): NormalizedPayload {
  // Resend webhook format
  if (body.data && typeof body.data === 'object') {
    const data = body.data as Record<string, unknown>;
    return {
      from: extractEmail(data.from as string),
      fromName: extractName(data.from as string),
      to: extractEmail(data.to as string),
      subject: (data.subject as string) || '',
      html: data.html as string,
      text: data.text as string,
      messageId: (data.message_id as string) || (data.messageId as string) || generateMessageId(),
      inReplyTo: data.in_reply_to as string,
      references: data.references as string,
      spamScore: data.spam_score as number,
      attachments: data.attachments as NormalizedPayload['attachments'],
    };
  }

  // SendGrid Inbound Parse format
  if (body.from && body.envelope) {
    return {
      from: extractEmail(body.from as string),
      fromName: extractName(body.from as string),
      to: extractEmail(body.to as string),
      subject: (body.subject as string) || '',
      html: body.html as string,
      text: body.text as string,
      messageId: (body['Message-ID'] as string) || (body.message_id as string) || generateMessageId(),
      inReplyTo: body['In-Reply-To'] as string,
      references: body['References'] as string,
      spamScore: body.spam_score ? Number(body.spam_score) : undefined,
    };
  }

  // Generic format
  return {
    from: extractEmail((body.from as string) || ''),
    fromName: extractName(body.from as string),
    to: (body.to as string) || '',
    subject: (body.subject as string) || '',
    html: body.html as string,
    text: body.text as string,
    messageId: (body.messageId as string) || (body.message_id as string) || generateMessageId(),
    inReplyTo: (body.inReplyTo as string) || (body.in_reply_to as string),
    references: body.references as string,
    spamScore: body.spamScore as number,
    attachments: body.attachments as NormalizedPayload['attachments'],
  };
}

function extractEmail(str: string | undefined): string {
  if (!str) return '';
  const match = str.match(/<([^>]+)>/);
  return match ? match[1] : str.trim();
}

function extractName(str: string | undefined): string | undefined {
  if (!str) return undefined;
  const match = str.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : undefined;
}

function generateMessageId(): string {
  return `<${Date.now()}.${Math.random().toString(36).slice(2)}@biocycle.ca>`;
}

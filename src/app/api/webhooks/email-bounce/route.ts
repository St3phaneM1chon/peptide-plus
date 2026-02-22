export const dynamic = 'force-dynamic';

/**
 * WEBHOOK - Email Bounce Handler
 *
 * Improvement #46: Receive bounce notifications from email providers
 * Supports: Resend, SendGrid webhook formats
 *
 * POST /api/webhooks/email-bounce
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { recordBounce, updateDeliveryStatus } from '@/lib/email/bounce-handler';
import { logger } from '@/lib/logger';

/**
 * Verify Resend/Svix webhook signature (HMAC-SHA256).
 * Resend sends: svix-id, svix-timestamp, svix-signature headers.
 */
function verifyResendSignature(
  rawBody: string,
  headers: { svixId: string; svixTimestamp: string; svixSignature: string },
  secret: string,
): boolean {
  // Svix secrets are base64-encoded with "whsec_" prefix
  const secretBytes = Buffer.from(secret.replace('whsec_', ''), 'base64');
  const toSign = `${headers.svixId}.${headers.svixTimestamp}.${rawBody}`;
  const expectedSig = createHmac('sha256', secretBytes).update(toSign).digest('base64');

  // svix-signature may contain multiple signatures separated by spaces
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
    const rawBody = await request.text();

    // Verify Resend webhook signature if secret is configured
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');

    // Fail-closed: if no webhook secret is configured, reject ALL webhooks
    if (!webhookSecret) {
      logger.warn('[email-bounce-webhook] RESEND_WEBHOOK_SECRET not configured — rejecting webhook');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    if (svixId && svixTimestamp && svixSignature) {
      // Reject if timestamp is too old (5 minutes tolerance)
      const ts = parseInt(svixTimestamp, 10);
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - ts) > 300) {
        return NextResponse.json({ error: 'Timestamp expired' }, { status: 401 });
      }
      if (!verifyResendSignature(rawBody, { svixId, svixTimestamp, svixSignature }, webhookSecret)) {
        logger.warn('[email-bounce-webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else if (!svixId) {
      // No Svix headers — check Bearer auth fallback
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${webhookSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Detect provider format and process
    if (body && typeof body === 'object' && 'type' in body && 'data' in body) {
      // Resend webhook format
      await processResendWebhook(body as { type: string; data: { email_id?: string; to?: string[]; created_at?: string; bounce_type?: string } });
    } else if (Array.isArray(body)) {
      // SendGrid event webhook format (array of events)
      for (const event of body) {
        await processSendGridEvent(event);
      }
    } else if (body && typeof body === 'object' && 'event' in body) {
      // Generic format
      await processGenericEvent(body as { event: string; email: string; bounceType?: string; provider?: string; reason?: string; messageId?: string });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('[email-bounce-webhook] Error processing webhook', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Processing error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Provider-specific parsers
// ---------------------------------------------------------------------------

async function processResendWebhook(payload: {
  type: string;
  data: { email_id?: string; to?: string[]; created_at?: string; bounce_type?: string };
}): Promise<void> {
  const { type, data } = payload;
  const email = data.to?.[0];
  if (!email) return;

  switch (type) {
    case 'email.bounced':
      await recordBounce({
        email,
        bounceType: data.bounce_type === 'soft' ? 'soft' : 'hard',
        provider: 'resend',
        messageId: data.email_id,
        timestamp: data.created_at ? new Date(data.created_at) : undefined,
      });
      break;

    case 'email.delivered':
      await updateDeliveryStatus({
        email,
        status: 'delivered',
        messageId: data.email_id || '',
        provider: 'resend',
        timestamp: data.created_at ? new Date(data.created_at) : undefined,
      });
      break;

    case 'email.opened':
      await updateDeliveryStatus({
        email,
        status: 'opened',
        messageId: data.email_id || '',
        provider: 'resend',
      });
      break;

    case 'email.clicked':
      await updateDeliveryStatus({
        email,
        status: 'clicked',
        messageId: data.email_id || '',
        provider: 'resend',
        timestamp: data.created_at ? new Date(data.created_at) : undefined,
      });
      break;

    case 'email.complained':
      await recordBounce({
        email,
        bounceType: 'hard',
        provider: 'resend',
        reason: 'complaint:spam_report',
        messageId: data.email_id,
      });
      await updateDeliveryStatus({
        email,
        status: 'complained',
        messageId: data.email_id || '',
        provider: 'resend',
      });
      break;

    case 'email.failed':
      await recordBounce({
        email,
        bounceType: 'soft',
        provider: 'resend',
        reason: 'delivery_failed',
        messageId: data.email_id,
        timestamp: data.created_at ? new Date(data.created_at) : undefined,
      });
      break;

    case 'email.delivery_delayed':
      await updateDeliveryStatus({
        email,
        status: 'delayed',
        messageId: data.email_id || '',
        provider: 'resend',
        timestamp: data.created_at ? new Date(data.created_at) : undefined,
      });
      break;

    case 'email.sent':
      await updateDeliveryStatus({
        email,
        status: 'sent',
        messageId: data.email_id || '',
        provider: 'resend',
        timestamp: data.created_at ? new Date(data.created_at) : undefined,
      });
      break;

    case 'email.suppressed':
      await recordBounce({
        email,
        bounceType: 'hard',
        provider: 'resend',
        reason: 'suppressed',
        messageId: data.email_id,
        timestamp: data.created_at ? new Date(data.created_at) : undefined,
      });
      break;
  }
}

async function processSendGridEvent(event: {
  event: string;
  email: string;
  sg_message_id?: string;
  type?: string;
  reason?: string;
  timestamp?: number;
}): Promise<void> {
  const email = event.email;
  if (!email) return;

  const timestamp = event.timestamp ? new Date(event.timestamp * 1000) : undefined;

  switch (event.event) {
    case 'bounce':
      await recordBounce({
        email,
        bounceType: event.type === 'blocked' ? 'soft' : 'hard',
        provider: 'sendgrid',
        reason: event.reason,
        messageId: event.sg_message_id,
        timestamp,
      });
      break;

    case 'delivered':
      await updateDeliveryStatus({
        email,
        status: 'delivered',
        messageId: event.sg_message_id || '',
        provider: 'sendgrid',
        timestamp,
      });
      break;

    case 'open':
      await updateDeliveryStatus({
        email,
        status: 'opened',
        messageId: event.sg_message_id || '',
        provider: 'sendgrid',
        timestamp,
      });
      break;

    case 'click':
      await updateDeliveryStatus({
        email,
        status: 'clicked',
        messageId: event.sg_message_id || '',
        provider: 'sendgrid',
        timestamp,
      });
      break;

    case 'spamreport':
      await recordBounce({
        email,
        bounceType: 'hard',
        provider: 'sendgrid',
        reason: 'complaint:spam_report',
        messageId: event.sg_message_id,
        timestamp,
      });
      await updateDeliveryStatus({
        email,
        status: 'complained',
        messageId: event.sg_message_id || '',
        provider: 'sendgrid',
        timestamp,
      });
      break;
  }
}

async function processGenericEvent(event: {
  event: string;
  email: string;
  bounceType?: string;
  provider?: string;
  reason?: string;
  messageId?: string;
}): Promise<void> {
  const provider = event.provider || 'unknown';

  switch (event.event) {
    case 'bounce':
      await recordBounce({
        email: event.email,
        bounceType: (event.bounceType as 'hard' | 'soft') || 'hard',
        provider,
        reason: event.reason,
        messageId: event.messageId,
      });
      break;
    case 'delivered':
    case 'opened':
    case 'clicked':
      await updateDeliveryStatus({
        email: event.email,
        status: event.event as 'delivered' | 'opened' | 'clicked',
        messageId: event.messageId || '',
        provider,
      });
      break;
    case 'complaint':
    case 'spamreport':
      await recordBounce({
        email: event.email,
        bounceType: 'hard',
        provider,
        reason: 'complaint:spam_report',
        messageId: event.messageId,
      });
      break;
  }
}

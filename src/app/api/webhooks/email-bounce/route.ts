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
import { recordBounce, updateDeliveryStatus } from '@/lib/email/bounce-handler';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET;
    const authHeader = request.headers.get('authorization');

    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      // Also check for provider-specific signatures
      const svixId = request.headers.get('svix-id'); // Resend uses Svix
      if (!svixId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json();

    // Detect provider format and process
    if (body.type && body.data) {
      // Resend webhook format
      await processResendWebhook(body);
    } else if (Array.isArray(body)) {
      // SendGrid event webhook format (array of events)
      for (const event of body) {
        await processSendGridEvent(event);
      }
    } else if (body.event) {
      // Generic format
      await processGenericEvent(body);
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
  data: { email_id?: string; to?: string[]; created_at?: string };
}): Promise<void> {
  const { type, data } = payload;
  const email = data.to?.[0];
  if (!email) return;

  switch (type) {
    case 'email.bounced':
      await recordBounce({
        email,
        bounceType: 'hard',
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

    case 'email.complained':
      await recordBounce({
        email,
        bounceType: 'hard',
        provider: 'resend',
        reason: 'complaint',
        messageId: data.email_id,
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

    case 'spamreport':
      await recordBounce({
        email,
        bounceType: 'hard',
        provider: 'sendgrid',
        reason: 'spam_report',
        messageId: event.sg_message_id,
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
  if (event.event === 'bounce') {
    await recordBounce({
      email: event.email,
      bounceType: (event.bounceType as 'hard' | 'soft') || 'hard',
      provider: event.provider || 'unknown',
      reason: event.reason,
      messageId: event.messageId,
    });
  }
}

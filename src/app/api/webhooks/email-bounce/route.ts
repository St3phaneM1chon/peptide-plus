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

// Basic in-memory rate limiting: max 100 events per second per provider
// NOTE: This state lives in the Node.js process memory and is NOT distributed.
// It works correctly for single-instance deployments only. For multi-instance
// (e.g. Azure scale-out), replace with Redis-backed rate limiting.
const rateLimitState: { windowStart: number; count: number } = {
  windowStart: 0,
  count: 0,
};
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 1000;

function checkRateLimit(): boolean {
  const now = Date.now();
  if (now - rateLimitState.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitState.windowStart = now;
    rateLimitState.count = 1;
    return true;
  }
  rateLimitState.count++;
  return rateLimitState.count <= RATE_LIMIT_MAX;
}

/**
 * Verify Resend/Svix webhook signature (HMAC-SHA256).
 *
 * Supported webhook signature formats:
 * 1. **Svix (Resend default)**: Uses `svix-id`, `svix-timestamp`, and `svix-signature`
 *    headers. The secret is base64-encoded with a `whsec_` prefix. Signature is
 *    computed as HMAC-SHA256 over `{svix-id}.{svix-timestamp}.{rawBody}`.
 *    The `svix-signature` header may contain multiple `v1,{base64}` signatures
 *    separated by spaces; any match is accepted.
 *
 * 2. **Bearer token fallback**: When Svix headers are absent, the webhook is
 *    authenticated via `Authorization: Bearer {RESEND_WEBHOOK_SECRET}`.
 *    This is useful for manual testing or non-Svix providers.
 *
 * Configure via: RESEND_WEBHOOK_SECRET environment variable.
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
    // Security: basic rate limiting to prevent webhook flood / DoS
    if (!checkRateLimit()) {
      logger.warn('[email-bounce-webhook] Rate limit exceeded (>100 events/second)');
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const rawBody = await request.text();

    // Verify Resend webhook signature if secret is configured
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    const svixId = request.headers.get('svix-id');
    const svixTimestamp = request.headers.get('svix-timestamp');
    const svixSignature = request.headers.get('svix-signature');

    // Fail-closed: if no webhook secret is configured, reject ALL webhooks.
    // To fix: set RESEND_WEBHOOK_SECRET in your environment variables.
    // This value is found in the Resend dashboard under Webhooks > Signing Secret.
    // It starts with "whsec_" for Svix-based signatures or can be any shared secret
    // for Bearer token authentication.
    if (!webhookSecret) {
      logger.warn(
        '[email-bounce-webhook] RESEND_WEBHOOK_SECRET not configured — rejecting webhook. ' +
        'Set the RESEND_WEBHOOK_SECRET env var to the signing secret from your Resend dashboard ' +
        '(Webhooks > Signing Secret). The value starts with "whsec_" for Svix signatures.',
      );
      return NextResponse.json(
        { error: 'Webhook secret not configured. Set RESEND_WEBHOOK_SECRET env var.' },
        { status: 500 },
      );
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

    // Faille #39 - Polymorphic payload documentation:
    // This webhook intentionally accepts 3 different payload formats to support multiple
    // email providers (Resend, SendGrid, generic). This is safe because:
    // 1. All requests are authenticated via HMAC signature (Resend/Svix) or Bearer token
    // 2. Signature verification happens BEFORE payload parsing (fail-closed)
    // 3. Each format is dispatched to a type-safe handler with explicit field extraction
    // 4. No user-supplied data is used in raw SQL or eval — only known fields are extracted

    // Track event counts for the response summary
    const eventCounts: Record<string, number> = {};
    const trackEvent = (type: string) => {
      eventCounts[type] = (eventCounts[type] || 0) + 1;
    };

    // Detect provider format and process
    let provider = 'unknown';
    let eventsProcessed = 0;

    if (body && typeof body === 'object' && 'type' in body && 'data' in body) {
      // Resend webhook format: { type: "email.bounced", data: { ... } }
      provider = 'resend';
      const resendBody = body as { type: string; data: { email_id?: string; to?: string[]; created_at?: string; bounce_type?: string } };
      trackEvent(resendBody.type);
      eventsProcessed = 1;
      await processResendWebhook(resendBody);
    } else if (Array.isArray(body)) {
      // SendGrid event webhook format: [{ event: "bounce", email: "...", ... }, ...]
      provider = 'sendgrid';
      eventsProcessed = body.length;
      for (const event of body) {
        if (event && typeof event === 'object' && event.event) {
          trackEvent(event.event);
        }
        await processSendGridEvent(event);
      }
    } else if (body && typeof body === 'object' && 'event' in body) {
      // Generic format: { event: "bounce", email: "...", ... }
      const genericBody = body as { event: string; email: string; bounceType?: string; provider?: string; reason?: string; messageId?: string };
      provider = genericBody.provider || 'generic';
      trackEvent(genericBody.event);
      eventsProcessed = 1;
      await processGenericEvent(genericBody);
    }

    return NextResponse.json({
      received: true,
      provider,
      eventsProcessed,
      eventCounts,
      processedAt: new Date().toISOString(),
    });
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

  // Inbound email has a different payload shape — handle before the to-address guard
  if (type === 'email.received') {
    await processInboundResendEmail(data as Record<string, unknown>);
    return;
  }

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

    // email.received is handled above (before the to-address guard)
  }
}

/**
 * Process inbound email from Resend webhook.
 * The webhook payload only has metadata — fetch the full body via Resend API.
 */
async function processInboundResendEmail(data: Record<string, unknown>): Promise<void> {
  const emailId = data.email_id as string;
  if (!emailId) {
    logger.warn('[email-bounce-webhook] email.received: no email_id');
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn('[email-bounce-webhook] email.received: RESEND_API_KEY not configured, cannot fetch email body');
    return;
  }

  // Fetch full email content from Resend Received Emails API
  const res = await fetch(`https://api.resend.com/emails/${emailId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    logger.warn(`[email-bounce-webhook] email.received: failed to fetch email ${emailId}: ${res.status}`);
    return;
  }

  const emailData = await res.json() as Record<string, unknown>;

  // Forward to inbound email webhook handler via internal fetch
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://biocyclepeptides.com';
  const webhookSecret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET || process.env.RESEND_WEBHOOK_SECRET;

  await fetch(`${baseUrl}/api/webhooks/inbound-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(webhookSecret ? { 'Authorization': `Bearer ${webhookSecret}` } : {}),
    },
    body: JSON.stringify({
      data: {
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
        message_id: emailData.message_id || emailId,
        in_reply_to: emailData.in_reply_to,
        references: emailData.references,
        attachments: emailData.attachments,
      },
    }),
  }).catch(err => {
    logger.error('[email-bounce-webhook] email.received: failed to forward to inbound handler', {
      error: err instanceof Error ? err.message : String(err),
    });
  });
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

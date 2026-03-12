export const dynamic = 'force-dynamic';

/**
 * WhatsApp Webhook (Twilio)
 * POST: Receives incoming WhatsApp messages via Twilio webhook.
 *       Parses the payload, creates/updates InboxConversation, creates InboxMessage.
 *       Validates Twilio signature if X-Twilio-Signature header is present.
 *
 * NO auth guard - this is a webhook endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';
import {
  processWhatsAppWebhook,
  createWhatsAppConversation,
  validateTwilioSignature,
} from '@/lib/crm/whatsapp';

const whatsappJsonSchema = z.record(z.string(), z.string());

export async function POST(request: NextRequest) {
  try {
    // Read the raw body (Twilio sends application/x-www-form-urlencoded)
    const contentType = request.headers.get('content-type') || '';
    let payload: Record<string, string>;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      payload = {} as Record<string, string>;
      formData.forEach((value, key) => {
        payload[key] = String(value);
      });
    } else {
      // JSON fallback
      try {
        const rawJson = await request.json();
        const parsed = whatsappJsonSchema.safeParse(rawJson);
        if (!parsed.success) {
          return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
        }
        payload = parsed.data;
      } catch {
        return NextResponse.json({ success: true }); // Acknowledge silently
      }
    }

    // Validate Twilio signature — REQUIRED in production to prevent spoofing
    const twilioSignature = request.headers.get('x-twilio-signature');
    const hasTwilioAuth = !!process.env.TWILIO_AUTH_TOKEN;

    if (hasTwilioAuth) {
      // Auth token configured: signature MUST be present and valid
      if (!twilioSignature) {
        logger.warn('[WhatsApp Webhook] Missing x-twilio-signature header');
        return NextResponse.json(
          { error: 'Missing signature' },
          { status: 401 },
        );
      }

      const requestUrl =
        process.env.WHATSAPP_WEBHOOK_URL ||
        `${request.nextUrl.origin}${request.nextUrl.pathname}`;

      const isValid = validateTwilioSignature(requestUrl, payload, twilioSignature);
      if (!isValid) {
        logger.warn('[WhatsApp Webhook] Invalid Twilio signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 },
        );
      }
    } else {
      logger.error('[WhatsApp Webhook] TWILIO_AUTH_TOKEN not configured — rejecting request');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    // Ignore non-message events (e.g., status callbacks)
    const messageSid = payload.MessageSid || payload.SmsSid;
    if (!messageSid) {
      // Could be a status callback, acknowledge it
      return NextResponse.json({ success: true });
    }

    // Idempotency check: skip if this message was already processed (Redis-based, TTL 24h)
    try {
      const redis = await getRedisClient();
      if (redis) {
        const idempotencyKey = `webhook:whatsapp:${messageSid}`;
        const alreadyProcessed = await redis.get(idempotencyKey);
        if (alreadyProcessed) {
          logger.info('[WhatsApp Webhook] Duplicate message skipped', { messageSid });
          return NextResponse.json({ success: true });
        }
        await redis.set(idempotencyKey, '1', 'EX', 86400);
      }
    } catch (redisErr) {
      // Redis unavailable — proceed without idempotency (prefer processing over skipping)
      logger.debug('[WhatsApp Webhook] Redis idempotency check unavailable, proceeding', {
        error: redisErr instanceof Error ? redisErr.message : String(redisErr),
      });
    }

    // Process the webhook
    const { from, body, messageId } = await processWhatsAppWebhook(payload);

    if (!from || !body) {
      logger.info('[WhatsApp Webhook] Empty from or body, skipping', { messageId });
      return NextResponse.json({ success: true });
    }

    // Create or update conversation and message
    const conversationId = await createWhatsAppConversation(from, body);

    logger.info('[WhatsApp Webhook] Message processed', {
      from,
      messageId,
      conversationId,
    });

    // Twilio expects a 200 response (TwiML or empty is fine)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      },
    );
  } catch (error) {
    logger.error('[WhatsApp Webhook] Error processing webhook', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Always return 200 for webhooks to prevent Twilio retries
    return NextResponse.json({ success: true });
  }
}

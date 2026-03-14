export const dynamic = 'force-dynamic';

/**
 * Meta Webhook (Facebook + Instagram)
 * GET:  Meta webhook verification (hub.verify_token, hub.challenge).
 * POST: Handle incoming Facebook Messenger and Instagram DM messages.
 *
 * NO auth guard - this is a webhook endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';
import {
  processFacebookMessage,
  processInstagramMessage,
} from '@/lib/crm/social-inbox';

const metaWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(z.record(z.unknown())).optional(),
}).passthrough();

/**
 * Verify Meta/Facebook webhook signature (HMAC-SHA256).
 * Meta sends x-hub-signature-256 header as "sha256=<hex>".
 */
function verifyMetaSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  try {
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    const sigHex = signature.replace('sha256=', '');
    if (sigHex.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(sigHex, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// GET: Webhook verification
// ---------------------------------------------------------------------------

/**
 * Timing-safe comparison of verify token to prevent timing attacks.
 */
function verifyTokenSafe(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const mode = request.nextUrl.searchParams.get('hub.mode');
    const token = request.nextUrl.searchParams.get('hub.verify_token');
    const challenge = request.nextUrl.searchParams.get('hub.challenge');

    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
    if (!verifyToken) {
      logger.error('[Meta Webhook] META_WEBHOOK_VERIFY_TOKEN not configured');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    if (mode === 'subscribe' && verifyTokenSafe(token, verifyToken)) {
      logger.info('[Meta Webhook] Verification successful');
      // Meta expects the challenge value as plain text response
      return new NextResponse(challenge || '', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    logger.warn('[Meta Webhook] Verification failed', {
      mode,
      tokenMatch: false,
    });
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 403 },
    );
  } catch (error) {
    logger.error('Meta webhook GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST: Handle incoming messages
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify Meta webhook signature (HMAC-SHA256) — REQUIRED in all environments
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      logger.error('[Meta Webhook] META_APP_SECRET not configured — rejecting request');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    } else {
      const signature = request.headers.get('x-hub-signature-256');
      if (!verifyMetaSignature(rawBody, signature, appSecret)) {
        logger.warn('[Meta Webhook] Invalid or missing x-hub-signature-256');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const rawParsed = JSON.parse(rawBody);
    const parsed = metaWebhookSchema.safeParse(rawParsed);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const payload = parsed.data;

    // Idempotency check: skip if this event was already processed (Redis-based, TTL 24h)
    // Meta doesn't provide a single event ID header, so derive one from the payload
    const metaEntryIds = (payload.entry as Array<Record<string, unknown>>)
      ?.map(e => e.id)
      .filter(Boolean)
      .join(',');
    const metaEventId = metaEntryIds
      ? `${payload.object}_${metaEntryIds}_${createHmac('sha256', 'meta-dedup').update(rawBody).digest('hex').slice(0, 16)}`
      : null;
    if (metaEventId) {
      try {
        const redis = await getRedisClient();
        if (redis) {
          const idempotencyKey = `webhook:meta:${metaEventId}`;
          const alreadyProcessed = await redis.get(idempotencyKey);
          if (alreadyProcessed) {
            logger.info('[Meta Webhook] Duplicate event skipped', { eventId: metaEventId });
            return NextResponse.json({ success: true });
          }
          await redis.set(idempotencyKey, '1', 'EX', 86400);
        }
      } catch (redisErr) {
        // Redis unavailable — proceed without idempotency (prefer processing over skipping)
        logger.debug('[Meta Webhook] Redis idempotency check unavailable, proceeding', {
          error: redisErr instanceof Error ? redisErr.message : String(redisErr),
        });
      }
    }

    // Determine the source: Facebook Messenger or Instagram
    const objectType = payload.object;

    if (objectType === 'page') {
      // Facebook Messenger webhook
      await processFacebookMessage(payload);
      logger.info('[Meta Webhook] Facebook message processed');
    } else if (objectType === 'instagram') {
      // Instagram DM webhook
      await processInstagramMessage(payload);
      logger.info('[Meta Webhook] Instagram message processed');
    } else {
      // Unknown object type - could be comments, reactions, etc.
      // Log and acknowledge
      logger.info('[Meta Webhook] Unhandled object type', {
        object: objectType,
      });
    }

    // Meta requires a 200 response within 20 seconds
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[Meta Webhook] Error processing webhook', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Always return 200 for Meta webhooks to prevent retries
    return NextResponse.json({ success: true });
  }
}

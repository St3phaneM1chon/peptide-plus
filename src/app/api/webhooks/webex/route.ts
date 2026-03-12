export const dynamic = 'force-dynamic';

/**
 * Webex Webhook Endpoint
 * POST - Receives Webex events (meetingEnded)
 * No admin guard - validated by X-Spark-Signature
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateWebexSignature, handleWebexWebhook } from '@/lib/platform/webhook-handlers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Validate Webex webhook signature (HMAC-SHA1 via x-spark-signature)
    const signature = request.headers.get('x-spark-signature');

    // Try DB-stored secret first, fall back to env var
    const connection = await prisma.platformConnection.findUnique({
      where: { platform: 'webex' },
      select: { webhookSecret: true },
    });
    const webhookSecret = connection?.webhookSecret || process.env.WEBEX_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.error('[Webhook] Webex webhook secret not configured — rejecting request');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    } else {
      if (!signature || !validateWebexSignature(rawBody, signature, webhookSecret)) {
        logger.warn('[Webhook] Webex: invalid or missing x-spark-signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody);

    // Idempotency check: skip if this event was already processed (Redis-based, TTL 24h)
    // Webex webhooks include an `id` field in the payload
    const webexEventId = body.id || body.actorId;
    if (webexEventId) {
      try {
        const redis = await getRedisClient();
        if (redis) {
          const idempotencyKey = `webhook:webex:${webexEventId}`;
          const alreadyProcessed = await redis.get(idempotencyKey);
          if (alreadyProcessed) {
            logger.info('[Webhook] Webex duplicate event skipped', { eventId: webexEventId });
            return NextResponse.json({ status: 'already_processed' });
          }
          await redis.set(idempotencyKey, '1', 'EX', 86400);
        }
      } catch (redisErr) {
        // Redis unavailable — proceed without idempotency (prefer processing over skipping)
        logger.debug('[Webhook] Webex Redis idempotency check unavailable, proceeding', {
          error: redisErr instanceof Error ? redisErr.message : String(redisErr),
        });
      }
    }

    const result = await handleWebexWebhook(body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logger.error('[Webhook] Webex error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

/**
 * Zoom Webhook Endpoint
 * POST - Receives Zoom events (recording.completed, url_validation)
 * No admin guard - validated by webhook signature
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateZoomSignature, handleZoomWebhook } from '@/lib/platform/webhook-handlers';
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN || '';
    if (!secret) {
      logger.error('[Webhook] ZOOM_WEBHOOK_SECRET_TOKEN not configured — rejecting request');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    // URL validation challenge uses HMAC on plainToken (no signature header)
    // All other events MUST have valid signature
    if (body.event !== 'endpoint.url_validation') {
      const timestamp = request.headers.get('x-zm-request-timestamp') || '';
      const signature = request.headers.get('x-zm-signature') || '';

      if (!validateZoomSignature(rawBody, timestamp, signature, secret)) {
        logger.warn('[Webhook] Zoom signature validation failed');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else {
      // For url_validation, verify the payload has a valid plainToken
      const plainToken = (body.payload as Record<string, unknown>)?.plainToken;
      if (!plainToken || typeof plainToken !== 'string' || plainToken.length > 256) {
        logger.warn('[Webhook] Zoom url_validation: invalid plainToken');
        return NextResponse.json({ error: 'Invalid plainToken' }, { status: 400 });
      }
    }

    // Idempotency check: skip if this event was already processed (Redis-based, TTL 24h)
    // Skip for url_validation challenges which must always be answered
    if (body.event !== 'endpoint.url_validation') {
      const zoomEventId = body.payload?.object?.id
        ? `${body.event}_${body.payload.object.id}_${body.event_ts || ''}`
        : null;
      if (zoomEventId) {
        try {
          const redis = await getRedisClient();
          if (redis) {
            const idempotencyKey = `webhook:zoom:${zoomEventId}`;
            const alreadyProcessed = await redis.get(idempotencyKey);
            if (alreadyProcessed) {
              logger.info('[Webhook] Zoom duplicate event skipped', { eventId: zoomEventId });
              return NextResponse.json({ status: 'already_processed' });
            }
            await redis.set(idempotencyKey, '1', 'EX', 86400);
          }
        } catch (redisErr) {
          // Redis unavailable — proceed without idempotency (prefer processing over skipping)
          logger.debug('[Webhook] Zoom Redis idempotency check unavailable, proceeding', {
            error: redisErr instanceof Error ? redisErr.message : String(redisErr),
          });
        }
      }
    }

    const result = await handleZoomWebhook(body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logger.error('[Webhook] Zoom error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

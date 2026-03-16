export const dynamic = 'force-dynamic';

/**
 * Microsoft Teams Webhook Endpoint
 * POST - Receives Graph API change notifications
 * No admin guard - validated by subscription token
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHmac, timingSafeEqual } from 'crypto';
import { handleTeamsWebhook } from '@/lib/platform/webhook-handlers';
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';

const teamsWebhookSchema = z.object({
  value: z.array(z.record(z.unknown())).optional(),
}).passthrough();

/**
 * Timing-safe comparison for bearer token verification.
 */
function verifyBearerToken(provided: string, expected: string): boolean {
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
    // Teams subscription validation - returns validationToken as query param
    // This must be handled BEFORE auth check, as Teams sends this during setup
    const { searchParams } = new URL(request.url);
    const validationToken = searchParams.get('validationToken');

    if (validationToken) {
      // Sanitize: Teams validationTokens are alphanumeric with hyphens/underscores
      // Reject anything that looks like an injection attempt
      if (!/^[\w\-.:]{1,512}$/.test(validationToken)) {
        logger.warn('[Webhook] Teams: suspicious validationToken rejected', {
          tokenLength: validationToken.length,
        });
        return NextResponse.json({ error: 'Invalid validation token' }, { status: 400 });
      }
      // Must return the token as plain text with content-type text/plain
      const result = await handleTeamsWebhook({}, validationToken);
      return new NextResponse(result.body as string, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Verify bearer token for all non-validation requests — REQUIRED in all environments
    const webhookSecret = process.env.TEAMS_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('[Webhook] TEAMS_WEBHOOK_SECRET not configured — rejecting request');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    } else {
      const authHeader = request.headers.get('authorization') || '';
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;

      if (!token || !verifyBearerToken(token, webhookSecret)) {
        logger.warn('[Webhook] Teams: invalid or missing authorization header');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const raw = await request.json();
    const parsed = teamsWebhookSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    // Idempotency check: skip if this notification was already processed (Redis-based, TTL 24h)
    // Teams Graph notifications don't have a single event ID, so derive one from payload hash
    const teamsEventId = createHmac('sha256', 'teams-dedup').update(JSON.stringify(raw)).digest('hex').slice(0, 32);
    try {
      const redis = await getRedisClient();
      if (redis) {
        const idempotencyKey = `webhook:teams:${teamsEventId}`;
        const alreadyProcessed = await redis.get(idempotencyKey);
        if (alreadyProcessed) {
          logger.info('[Webhook] Teams duplicate event skipped', { eventId: teamsEventId });
          return NextResponse.json({ status: 'already_processed' });
        }
        await redis.set(idempotencyKey, '1', 'EX', 86400);
      }
    } catch (redisErr) {
      // Redis unavailable — proceed without idempotency (prefer processing over skipping)
      logger.debug('[Webhook] Teams Redis idempotency check unavailable, proceeding', {
        error: redisErr instanceof Error ? redisErr.message : String(redisErr),
      });
    }

    const result = await handleTeamsWebhook(parsed.data);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logger.error('[Webhook] Teams error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

/**
 * Microsoft Teams Webhook Endpoint
 * POST - Receives Graph API change notifications
 * No admin guard - validated by subscription token
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import { handleTeamsWebhook } from '@/lib/platform/webhook-handlers';
import { logger } from '@/lib/logger';

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
      // Must return the token as plain text with content-type text/plain
      const result = await handleTeamsWebhook({}, validationToken);
      return new NextResponse(result.body as string, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Verify bearer token for all non-validation requests
    const webhookSecret = process.env.TEAMS_WEBHOOK_SECRET;
    if (!webhookSecret) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('[Webhook] TEAMS_WEBHOOK_SECRET not configured in production');
        return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
      }
      logger.warn('[Webhook] TEAMS_WEBHOOK_SECRET not set — skipping verification (dev mode)');
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
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }
    const result = await handleTeamsWebhook(parsed.data);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logger.error('[Webhook] Teams error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

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
      if (process.env.NODE_ENV === 'production') {
        logger.error('[Webhook] Webex webhook secret not configured in production');
        return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
      }
      logger.warn('[Webhook] Webex webhook secret not set — skipping verification (dev mode)');
    } else {
      if (!signature || !validateWebexSignature(rawBody, signature, webhookSecret)) {
        logger.warn('[Webhook] Webex: invalid or missing x-spark-signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody);
    const result = await handleWebexWebhook(body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logger.error('[Webhook] Webex error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

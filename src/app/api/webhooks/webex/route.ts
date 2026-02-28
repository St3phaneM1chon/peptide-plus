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

    // Validate signature
    const signature = request.headers.get('x-spark-signature') || '';
    const connection = await prisma.platformConnection.findUnique({
      where: { platform: 'webex' },
      select: { webhookSecret: true },
    });

    if (connection?.webhookSecret && signature) {
      if (!validateWebexSignature(rawBody, signature, connection.webhookSecret)) {
        logger.warn('[Webhook] Webex signature validation failed');
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

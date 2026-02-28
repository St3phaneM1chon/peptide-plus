export const dynamic = 'force-dynamic';

/**
 * Zoom Webhook Endpoint
 * POST - Receives Zoom events (recording.completed, url_validation)
 * No admin guard - validated by webhook signature
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateZoomSignature, handleZoomWebhook } from '@/lib/platform/webhook-handlers';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Validate signature (skip for URL validation challenge)
    if (body.event !== 'endpoint.url_validation') {
      const timestamp = request.headers.get('x-zm-request-timestamp') || '';
      const signature = request.headers.get('x-zm-signature') || '';
      const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN || '';

      if (!secret) {
        logger.warn('[Webhook] Zoom webhook secret not configured');
        return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
      }

      if (!validateZoomSignature(rawBody, timestamp, signature, secret)) {
        logger.warn('[Webhook] Zoom signature validation failed');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const result = await handleZoomWebhook(body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logger.error('[Webhook] Zoom error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

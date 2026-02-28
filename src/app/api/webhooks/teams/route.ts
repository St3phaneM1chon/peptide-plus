export const dynamic = 'force-dynamic';

/**
 * Microsoft Teams Webhook Endpoint
 * POST - Receives Graph API change notifications
 * No admin guard - validated by subscription token
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleTeamsWebhook } from '@/lib/platform/webhook-handlers';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Teams subscription validation - returns validationToken as query param
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

    const body = await request.json();
    const result = await handleTeamsWebhook(body);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    logger.error('[Webhook] Teams error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

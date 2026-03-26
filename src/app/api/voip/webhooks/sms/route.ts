export const dynamic = 'force-dynamic';

/**
 * Telnyx SMS/MMS Webhook Handler
 *
 * Receives inbound SMS/MMS events from Telnyx messaging profile.
 * Delegates to the SMS Engine for:
 *   - Opt-out/opt-in handling (STOP/START keywords)
 *   - InboxConversation creation + InboxMessage logging
 *   - CrmActivity creation
 *   - Push notification to staff
 *
 * Configure in Telnyx Portal > Messaging > Inbound webhook:
 *   https://biocyclepeptides.com/api/voip/webhooks/sms
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { handleIncomingSMS } from '@/lib/voip/sms-engine';

export async function POST(request: NextRequest) {
  try {
    // VOIP-F2 CRITICAL FIX: Verify Telnyx webhook signature (was missing entirely)
    const publicKeyBase64 = process.env.TELNYX_WEBHOOK_SECRET;
    if (!publicKeyBase64) {
      logger.error('[SMS Webhook] TELNYX_WEBHOOK_SECRET not set — rejecting');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    const signature = request.headers.get('telnyx-signature-ed25519');
    const timestamp = request.headers.get('telnyx-timestamp');
    if (!signature || !timestamp) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 403 });
    }

    // Ed25519 verification (same as call webhook)
    try {
      const { verify } = await import('crypto');
      const rawBody = await request.clone().text();
      const publicKeyDer = Buffer.from(publicKeyBase64, 'base64');
      const signedPayload = `${timestamp}|${rawBody}`;
      const signatureBuffer = Buffer.from(signature, 'base64');
      const isValid = verify(null, Buffer.from(signedPayload), { key: publicKeyDer, format: 'der', type: 'spki' }, signatureBuffer);
      if (!isValid) {
        logger.warn('[SMS Webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } catch {
      logger.warn('[SMS Webhook] Signature verification error');
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
    }

    const body = await request.json();
    const data = body?.data;
    const eventType = data?.event_type || body?.event_type;

    // Telnyx sends message events with event_type "message.received"
    if (eventType === 'message.received') {
      const payload = data?.payload || {};
      const from: string = payload.from?.phone_number || payload.from || '';
      const toRaw = payload.to;
      const to: string = Array.isArray(toRaw)
        ? toRaw[0]?.phone_number || ''
        : typeof toRaw === 'string'
          ? toRaw
          : payload.to?.phone_number || '';
      const text: string = payload.text || '';
      const messageId: string | undefined = payload.id || data?.id;
      const direction: string = payload.direction || 'inbound';

      logger.info('[SMS Webhook] Message received', {
        from,
        direction,
        textPreview: text.slice(0, 50),
      });

      // Delegate inbound messages to the SMS Engine
      if (direction === 'inbound' && from) {
        await handleIncomingSMS({ from, to, text, messageId });
      }
    }

    // Delivery receipts (message.sent, message.finalized, message.failed)
    if (
      eventType === 'message.sent' ||
      eventType === 'message.finalized' ||
      eventType === 'message.failed'
    ) {
      const payload = data?.payload || {};
      logger.info('[SMS Webhook] Delivery status', {
        eventType,
        messageId: payload.id,
        to: payload.to,
        errors: payload.errors,
      });
      // TODO: Update InboxMessage status based on delivery receipt
    }

    // Always respond 200 to Telnyx (avoid retries)
    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('[SMS Webhook] Error', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Still return 200 to prevent Telnyx from retrying indefinitely
    return NextResponse.json({ received: true });
  }
}

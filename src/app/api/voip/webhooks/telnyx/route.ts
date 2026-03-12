export const dynamic = 'force-dynamic';

/**
 * Telnyx Call Control Webhook Handler
 *
 * Receives events from Telnyx for call lifecycle management:
 * - call.initiated / call.answered / call.hangup
 * - call.dtmf.received (IVR input)
 * - call.recording.saved
 * - call.machine.detection.ended (AMD)
 * - streaming.started / streaming.stopped (transcription)
 *
 * Configure this URL in Telnyx Portal:
 *   https://biocyclepeptides.com/api/voip/webhooks/telnyx
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';
import { handleCallEvent } from '@/lib/voip/call-control';
import { WebhookDispatcher } from '@/lib/voip/webhook-dispatcher';

// Singleton dispatcher — loads webhook configs from DB on first use
let _dispatcher: WebhookDispatcher | null = null;
async function getDispatcher(): Promise<WebhookDispatcher> {
  if (!_dispatcher) {
    _dispatcher = new WebhookDispatcher();
    await _dispatcher.loadFromDB();
  }
  return _dispatcher;
}

// Telnyx webhook event structure
interface TelnyxWebhookEvent {
  data: {
    event_type: string;
    id: string;
    occurred_at: string;
    payload: {
      call_control_id: string;
      call_leg_id?: string;
      call_session_id?: string;
      connection_id?: string;
      from?: string;
      to?: string;
      direction?: string;
      state?: string;
      client_state?: string;
      hangup_cause?: string;
      hangup_source?: string;
      // DTMF
      digit?: string;
      digits?: string;
      // Recording
      recording_urls?: {
        mp3?: string;
        wav?: string;
      };
      // AMD
      result?: string; // "human", "machine", "not_sure"
      // Transcription
      transcription_data?: {
        text: string;
        confidence: number;
        is_final: boolean;
      };
    };
  };
  meta?: {
    attempt: number;
    delivered_to: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify Telnyx webhook signature (HMAC-SHA256)
    const signingSecret = process.env.TELNYX_WEBHOOK_SECRET;
    if (signingSecret) {
      const signature = request.headers.get('telnyx-signature-ed25519')
        || request.headers.get('x-telnyx-signature');
      const timestamp = request.headers.get('telnyx-timestamp');

      if (!signature || !timestamp) {
        logger.warn('[Telnyx Webhook] Missing signature or timestamp header');
        return NextResponse.json({ error: 'Missing signature' }, { status: 403 });
      }

      // Verify that the timestamp is not too old (5 minutes) to prevent replay attacks
      const timestampAge = Math.abs(Date.now() / 1000 - parseInt(timestamp));
      if (isNaN(timestampAge) || timestampAge > 300) {
        logger.warn('[Telnyx Webhook] Timestamp too old or invalid', { timestamp, ageSeconds: timestampAge });
        return NextResponse.json({ error: 'Timestamp too old' }, { status: 403 });
      }

      // HMAC verification: sha256(timestamp + rawBody)
      const expectedSignature = createHmac('sha256', signingSecret)
        .update(timestamp + rawBody)
        .digest('hex');

      try {
        if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
          logger.warn('[Telnyx Webhook] Invalid signature');
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      } catch {
        logger.warn('[Telnyx Webhook] Signature comparison failed');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else {
      // In production, reject requests when webhook secret is not configured
      if (process.env.NODE_ENV === 'production') {
        logger.error('[Telnyx Webhook] TELNYX_WEBHOOK_SECRET not set in production — rejecting request');
        return NextResponse.json({ error: 'Webhook signature verification not configured' }, { status: 401 });
      }
      logger.warn('[Telnyx Webhook] TELNYX_WEBHOOK_SECRET not set — skipping signature verification (dev mode)');
    }

    // Parse the webhook event
    let event: TelnyxWebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      logger.warn('[Telnyx Webhook] Invalid JSON body');
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { event_type, id: telnyxEventId, payload } = event.data;
    const callControlId = payload.call_control_id;

    // Idempotency check: skip if this event was already processed (Redis-based, TTL 24h)
    if (telnyxEventId) {
      try {
        const redis = await getRedisClient();
        if (redis) {
          const idempotencyKey = `webhook:telnyx:${telnyxEventId}`;
          const alreadyProcessed = await redis.get(idempotencyKey);
          if (alreadyProcessed) {
            logger.info('[Telnyx Webhook] Duplicate event skipped', { eventId: telnyxEventId, type: event_type });
            return NextResponse.json({ status: 'already_processed' });
          }
          await redis.set(idempotencyKey, '1', 'EX', 86400);
        }
      } catch (redisErr) {
        // Redis unavailable — proceed without idempotency (prefer processing over skipping)
        logger.debug('[Telnyx Webhook] Redis idempotency check unavailable, proceeding', {
          error: redisErr instanceof Error ? redisErr.message : String(redisErr),
        });
      }
    }

    logger.info('[Telnyx Webhook] Event received', {
      type: event_type,
      callControlId,
      from: payload.from,
      to: payload.to,
      direction: payload.direction,
    });

    // Decode client_state if present (base64 encoded)
    let clientState: Record<string, unknown> | undefined;
    if (payload.client_state) {
      try {
        const decoded = Buffer.from(payload.client_state, 'base64').toString('utf-8');
        clientState = JSON.parse(decoded);
      } catch {
        // client_state is opaque, not always JSON — safe to ignore parse failures
        logger.debug('[Telnyx Webhook] client_state is not valid JSON (opaque value)', { callControlId });
      }
    }

    // Route event to appropriate handler
    await handleCallEvent(event_type, {
      callControlId,
      callLegId: payload.call_leg_id,
      callSessionId: payload.call_session_id,
      connectionId: payload.connection_id,
      from: payload.from,
      to: payload.to,
      direction: payload.direction as 'inbound' | 'outbound' | undefined,
      state: payload.state,
      clientState,
      hangupCause: payload.hangup_cause,
      hangupSource: payload.hangup_source,
      digit: payload.digit,
      digits: payload.digits,
      recordingUrls: payload.recording_urls,
      amdResult: payload.result,
      transcriptionData: payload.transcription_data,
    });

    // Dispatch event to configured external webhook targets (Zapier, Make, etc.)
    // Fire-and-forget: don't block the Telnyx acknowledgment
    getDispatcher().then(dispatcher => {
      dispatcher.dispatch(event_type, {
        callControlId,
        from: payload.from,
        to: payload.to,
        direction: payload.direction,
        state: payload.state,
        hangupCause: payload.hangup_cause,
        recordingUrls: payload.recording_urls,
        transcriptionData: payload.transcription_data,
        occurredAt: event.data.occurred_at,
      }).catch(err => {
        logger.warn('[Telnyx Webhook] External dispatch failed', {
          event: event_type,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }).catch((err) => {
      logger.warn('[Telnyx Webhook] Dispatcher init failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // Always return 200 to Telnyx to acknowledge receipt
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    logger.error('[Telnyx Webhook] Handler error', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Still return 200 to prevent Telnyx retries on processing errors
    return NextResponse.json({ status: 'error', message: 'Internal processing error' });
  }
}

/**
 * HEAD/GET for Telnyx webhook URL verification.
 */
export async function GET() {
  try {
    return NextResponse.json({ status: 'Telnyx webhook endpoint active' });
  } catch (error) {
    console.error('[voip/webhooks/telnyx GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

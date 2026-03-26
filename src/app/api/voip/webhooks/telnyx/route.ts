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
 *
 * SECURITY AUDIT 2026-03-15: PAYMENT-PCI — VERIFIED SAFE.
 * POST handler verifies Telnyx Ed25519 signature using TELNYX_WEBHOOK_SECRET (public key).
 * Includes timestamp replay protection (5-minute window).
 * Redis-based idempotency check prevents duplicate event processing (24h TTL).
 *
 * CRITICAL FIX 2026-03-19: Telnyx sends direction='incoming'/'outgoing', NOT 'inbound'/'outbound'.
 * The webhook handler now normalizes direction before passing to call-control.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verify } from 'crypto';
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

    // Verify Telnyx webhook signature (Ed25519)
    // Telnyx signs webhooks using Ed25519 (NOT HMAC-SHA256).
    // The public key is the TELNYX_WEBHOOK_SECRET (base64-encoded Ed25519 public key).
    const publicKeyBase64 = process.env.TELNYX_WEBHOOK_SECRET;
    if (publicKeyBase64) {
      const signature = request.headers.get('telnyx-signature-ed25519');
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

      // Ed25519 verification: verify(timestamp + rawBody) against signature using public key
      try {
        const signedPayload = `${timestamp}|${rawBody}`;
        const signatureBuffer = Buffer.from(signature, 'base64');
        const publicKeyDer = Buffer.concat([
          // Ed25519 DER prefix for SubjectPublicKeyInfo
          Buffer.from('302a300506032b6570032100', 'hex'),
          Buffer.from(publicKeyBase64, 'base64'),
        ]);

        const isValid = verify(
          null, // Ed25519 doesn't use a separate hash algorithm
          Buffer.from(signedPayload),
          { key: publicKeyDer, format: 'der', type: 'spki' },
          signatureBuffer,
        );

        if (!isValid) {
          logger.warn('[Telnyx Webhook] Invalid Ed25519 signature');
          return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }
      } catch (verifyErr) {
        logger.warn('[Telnyx Webhook] Signature verification failed', {
          error: verifyErr instanceof Error ? verifyErr.message : String(verifyErr),
        });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else {
      // VOIP-F1 CRITICAL FIX: Reject when secret not configured (was silently accepting)
      logger.error('[Telnyx Webhook] TELNYX_WEBHOOK_SECRET not set — REJECTING request');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
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

    // Normalize Telnyx direction: 'incoming'→'inbound', 'outgoing'→'outbound'
    // Telnyx Call Control API sends 'incoming'/'outgoing' but our internal code
    // uses 'inbound'/'outbound'. This mismatch was the root cause of calls not
    // being answered — answerCall() was never called because 'incoming' !== 'inbound'.
    const normalizedDirection = payload.direction === 'incoming' ? 'inbound'
      : payload.direction === 'outgoing' ? 'outbound'
      : (payload.direction as 'inbound' | 'outbound' | undefined);

    // Route event to appropriate handler
    await handleCallEvent(event_type, {
      callControlId,
      callLegId: payload.call_leg_id,
      callSessionId: payload.call_session_id,
      connectionId: payload.connection_id,
      from: payload.from,
      to: payload.to,
      direction: normalizedDirection,
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
    logger.error('Telnyx webhook GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

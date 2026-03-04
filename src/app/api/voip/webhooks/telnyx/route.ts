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
import { logger } from '@/lib/logger';
import { handleCallEvent } from '@/lib/voip/call-control';

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

    // Parse the webhook event
    let event: TelnyxWebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      logger.warn('[Telnyx Webhook] Invalid JSON body');
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { event_type, payload } = event.data;
    const callControlId = payload.call_control_id;

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
        // client_state is opaque, not always JSON
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
  return NextResponse.json({ status: 'Telnyx webhook endpoint active' });
}

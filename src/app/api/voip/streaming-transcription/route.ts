export const dynamic = 'force-dynamic';

/**
 * Streaming Transcription API
 *
 * GET /api/voip/streaming-transcription?callId=xxx
 *   SSE endpoint that streams transcription events for a live call.
 *   The client connects via EventSource and receives interim/final transcription
 *   results in real time.
 *
 * POST /api/voip/streaming-transcription
 *   Body: { callId, text, type: "interim"|"final", speaker?, confidence? }
 *   Accepts transcription chunks (e.g., from a WebSocket transcription relay)
 *   and pushes them to any connected SSE listeners.
 *
 * Authentication: Requires authenticated session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import {
  type TranscriptionEvent,
  type StreamingTranscriptionConfig,
} from '@/lib/voip/streaming-transcription';
import { logger } from '@/lib/logger';

const transcriptionEventSchema = z.object({
  callId: z.string().min(1, 'callId is required'),
  text: z.string().min(1, 'text is required'),
  type: z.enum(['interim', 'final']),
  speaker: z.enum(['agent', 'customer']).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

// ---------------------------------------------------------------------------
// In-memory event bus for SSE (per-call transcription events)
// ---------------------------------------------------------------------------

type TranscriptionListener = (event: TranscriptionEvent) => void;

const callListeners = new Map<string, Set<TranscriptionListener>>();
const callTranscripts = new Map<string, TranscriptionEvent[]>();

function addListener(callId: string, listener: TranscriptionListener): void {
  if (!callListeners.has(callId)) {
    callListeners.set(callId, new Set());
  }
  callListeners.get(callId)!.add(listener);
}

function removeListener(callId: string, listener: TranscriptionListener): void {
  callListeners.get(callId)?.delete(listener);
  if (callListeners.get(callId)?.size === 0) {
    callListeners.delete(callId);
  }
}

function pushEvent(callId: string, event: TranscriptionEvent): void {
  // Store transcript history
  if (!callTranscripts.has(callId)) {
    callTranscripts.set(callId, []);
  }
  callTranscripts.get(callId)!.push(event);

  // Limit stored events per call to 1000
  const events = callTranscripts.get(callId)!;
  if (events.length > 1000) {
    callTranscripts.set(callId, events.slice(-500));
  }

  // Notify all SSE listeners
  const listeners = callListeners.get(callId);
  if (listeners) {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // Listener may have been disconnected
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Re-export config type for downstream use
// ---------------------------------------------------------------------------

export type { StreamingTranscriptionConfig, TranscriptionEvent };

// ---------------------------------------------------------------------------
// GET: SSE stream of transcription events
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const callId = request.nextUrl.searchParams.get('callId');
  if (!callId) {
    return NextResponse.json(
      { error: 'callId query parameter is required' },
      { status: 400 }
    );
  }

  logger.info('[streaming-transcription] SSE connection opened', {
    callId,
    userId: session.user.id,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send any existing transcript events as replay
      const existing = callTranscripts.get(callId) || [];
      for (const event of existing) {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      }

      // Register listener for new events
      const listener: TranscriptionListener = (event) => {
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          // Stream may have been closed by client
          removeListener(callId, listener);
        }
      };

      addListener(callId, listener);

      // Cleanup when the stream is cancelled (client disconnects)
      request.signal.addEventListener('abort', () => {
        removeListener(callId, listener);
        logger.info('[streaming-transcription] SSE connection closed', {
          callId,
          userId: session.user.id,
        });
        controller.close();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// ---------------------------------------------------------------------------
// POST: Push transcription event from a relay/webhook
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = transcriptionEventSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { callId, text, type, speaker, confidence } = parsed.data;

    const event: TranscriptionEvent = {
      type,
      text,
      confidence: typeof confidence === 'number' ? confidence : 0.8,
      timestamp: Date.now(),
      duration: 0,
      speaker: speaker || undefined,
    };

    pushEvent(callId, event);

    const listenerCount = callListeners.get(callId)?.size ?? 0;

    return NextResponse.json({
      success: true,
      callId,
      listenerCount,
    });
  } catch (error) {
    logger.error('[streaming-transcription] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

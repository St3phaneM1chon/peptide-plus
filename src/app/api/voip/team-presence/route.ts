export const dynamic = 'force-dynamic';

/**
 * VoIP Team Presence — Server-Sent Events (SSE) stream
 *
 * GET    /api/voip/team-presence — Real-time team presence via SSE
 *
 * Returns a continuous event stream with presence updates for all team members.
 * Format: data: {JSON}\n\n
 */

import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

/**
 * GET - SSE stream of team presence updates.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  let isStreamClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      /**
       * Helper to send an SSE event.
       */
      function sendEvent(eventType: string, data: unknown) {
        if (isStreamClosed) return;
        try {
          const payload = JSON.stringify({ event: eventType, data, timestamp: new Date().toISOString() });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          // Stream may have been closed by client
          isStreamClosed = true;
        }
      }

      try {
        // Step 1: Send initial presence data for all team members
        const initialPresences = await prisma.presenceStatus.findMany({
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: 200,
        });

        sendEvent('initial', initialPresences);

        // Step 2: Poll for changes every 5 seconds
        let lastPollTime = new Date();

        const pollInterval = setInterval(async () => {
          if (isStreamClosed) {
            clearInterval(pollInterval);
            return;
          }

          try {
            // Query for presences updated since last poll
            const updatedPresences = await prisma.presenceStatus.findMany({
              where: {
                lastActivity: { gte: lastPollTime },
              },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
              orderBy: { updatedAt: 'desc' },
              take: 200,
            });

            lastPollTime = new Date();

            if (updatedPresences.length > 0) {
              sendEvent('update', updatedPresences);
            } else {
              // Send heartbeat to keep connection alive
              sendEvent('heartbeat', { count: updatedPresences.length });
            }
          } catch (pollError) {
            logger.error('[VoIP TeamPresence] Poll error', {
              error: pollError instanceof Error ? pollError.message : String(pollError),
            });
            // Send error event but keep stream alive
            sendEvent('error', { message: 'Failed to poll presence updates' });
          }
        }, 5000);

        // Clean up when the client disconnects
        request.signal.addEventListener('abort', () => {
          isStreamClosed = true;
          clearInterval(pollInterval);
          try {
            controller.close();
          } catch {
            // Already closed
          }
        });
      } catch (initError) {
        logger.error('[VoIP TeamPresence] Failed to initialize SSE stream', {
          error: initError instanceof Error ? initError.message : String(initError),
        });
        sendEvent('error', { message: 'Failed to initialize presence stream' });
        isStreamClosed = true;
        controller.close();
      }
    },

    cancel() {
      isStreamClosed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

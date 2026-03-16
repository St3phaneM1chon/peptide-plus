export const dynamic = 'force-dynamic';

/**
 * SSE endpoint for real-time chat events.
 * Subscribes to Redis Pub/Sub and streams chat events (message, typing, read, presence)
 * to connected admin users.
 *
 * Pattern follows: src/app/api/admin/notifications/stream/route.ts
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { getRedisPubSubClient } from '@/lib/redis';
import { getChatChannel, type ChatEvent } from '@/lib/chat/realtime';
import { logger } from '@/lib/logger';
import { getClientIpFromRequest } from '@/lib/admin-audit';

// Simple rate limiter for SSE connections (max 3 concurrent per IP)
const activeConnections = new Map<string, number>();
const MAX_CONCURRENT_SSE = 3;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const role = session.user.role as string;
    if (role !== UserRole.EMPLOYEE && role !== UserRole.OWNER) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Rate limit: max concurrent SSE connections per IP
    const ip = getClientIpFromRequest(request);
    const currentCount = activeConnections.get(ip) || 0;
    if (currentCount >= MAX_CONCURRENT_SSE) {
      return new Response(JSON.stringify({ error: 'Too many concurrent SSE connections' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    activeConnections.set(ip, currentCount + 1);

    const subscriber = await getRedisPubSubClient();
    const encoder = new TextEncoder();

    const cleanup = () => {
      const count = activeConnections.get(ip) || 1;
      if (count <= 1) {
        activeConnections.delete(ip);
      } else {
        activeConnections.set(ip, count - 1);
      }
      if (subscriber) {
        try {
          subscriber.quit();
        } catch (quitErr) {
          // Connection already closed — expected during SSE cleanup
          logger.error('[chat:stream] Redis subscriber quit failed', { error: quitErr instanceof Error ? quitErr.message : String(quitErr) });
        }
      }
    };

    const stream = new ReadableStream({
      async start(controller) {
        // Send heartbeat every 30s to keep connection alive
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'));
          } catch (hbErr) {
            // Controller already closed — expected during SSE cleanup
            logger.error('[chat:stream] Heartbeat enqueue failed (stream closed)', { error: hbErr instanceof Error ? hbErr.message : String(hbErr) });
          }
        }, 30000);

        if (subscriber) {
          try {
            await subscriber.subscribe(getChatChannel());
            subscriber.on('message', (...args: unknown[]) => {
              // ioredis passes (channel, message) to the 'message' event
              const message = args[1] as string;
              try {
                const event: ChatEvent = JSON.parse(message);
                const sseData = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
                controller.enqueue(encoder.encode(sseData));
              } catch (err) {
                logger.error('[chat:stream] Failed to process message', {
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            });
          } catch (err) {
            logger.error('[chat:stream] Failed to subscribe', {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        // If Redis is unavailable, the SSE connection stays open but no events
        // are pushed. The client (useChatSSE) can fall back to periodic polling
        // if needed via its own logic.

        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          cleanup();
          try {
            controller.close();
          } catch (closeErr) {
            // Controller already closed — expected during SSE cleanup
            logger.error('[chat:stream] Controller close failed', { error: closeErr instanceof Error ? closeErr.message : String(closeErr) });
          }
        });
      },
      cancel() {
        cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    logger.error('Chat stream error', { error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

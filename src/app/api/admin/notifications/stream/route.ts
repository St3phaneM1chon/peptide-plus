export const dynamic = 'force-dynamic';

/**
 * SSE endpoint for real-time admin notification badges.
 * Streams order count, unread chat count, and alert count every 10s.
 *
 * Error handling strategy:
 * - Auth/permission failures return a valid SSE stream with an error event
 *   and a high retry value so the browser doesn't flood the console with
 *   "Failed to load resource" errors from rapid EventSource reconnects.
 * - The client (useAdminSSE) independently implements exponential backoff.
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import { logger } from '@/lib/logger';
import { getClientIpFromRequest } from '@/lib/admin-audit';

// NOTE: This SSE endpoint uses manual auth checks instead of withAdminGuard because
// withAdminGuard sets rate-limit headers on the response and casts it to NextResponse,
// which is incompatible with the streaming Response (ReadableStream) returned by SSE.
// The auth + role checks below are equivalent to withAdminGuard's authentication layer.

// Simple rate limiter for SSE connections (max 3 concurrent per IP)
const activeConnections = new Map<string, number>();
const MAX_CONCURRENT_SSE = 3;

/**
 * Return a valid SSE response that sends a single error event then closes.
 * This prevents EventSource from logging "Failed to load resource" errors
 * because the response has the correct Content-Type and status 200.
 * The retry field tells the browser to wait 5 minutes before reconnecting.
 */
function sseErrorResponse(reason: string): Response {
  const encoder = new TextEncoder();
  const body = encoder.encode(
    `retry: 300000\nevent: error\ndata: ${JSON.stringify({ error: reason })}\n\n`
  );

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

async function getNotificationCounts() {
  const [pendingOrders, unreadChats, lowStockCount] = await Promise.all([
    prisma.order.count({
      where: { status: { in: ['PENDING', 'CONFIRMED'] } },
    }).catch(() => 0),
    prisma.chatConversation.count({
      where: { status: { in: ['ACTIVE', 'WAITING_ADMIN'] } },
    }).catch(() => 0),
    prisma.productOption.count({
      where: {
        isActive: true,
        stockQuantity: { lte: 5 },
      },
    }).catch(() => 0),
  ]);

  return { pendingOrders, unreadChats, lowStockCount };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return sseErrorResponse('Unauthorized');
    }

    const role = session.user.role as string;
    if (role !== UserRole.EMPLOYEE && role !== UserRole.OWNER) {
      return sseErrorResponse('Forbidden');
    }

    // Rate limit: max concurrent SSE connections per IP
    const ip = getClientIpFromRequest(request);
    const currentCount = activeConnections.get(ip) || 0;
    if (currentCount >= MAX_CONCURRENT_SSE) {
      return sseErrorResponse('Too many concurrent SSE connections');
    }
    activeConnections.set(ip, currentCount + 1);

    const encoder = new TextEncoder();
    let intervalId: ReturnType<typeof setInterval>;

    const cleanup = () => {
      clearInterval(intervalId);
      const count = activeConnections.get(ip) || 1;
      if (count <= 1) {
        activeConnections.delete(ip);
      } else {
        activeConnections.set(ip, count - 1);
      }
    };

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = async () => {
          try {
            const counts = await getNotificationCounts();
            const data = `data: ${JSON.stringify(counts)}\n\n`;
            controller.enqueue(encoder.encode(data));
          } catch (error) {
            logger.error('[NotificationStream] Failed to send SSE event (connection may be closed)', { error: error instanceof Error ? error.message : String(error) });
          }
        };

        // Send initial data immediately
        await sendEvent();

        // Then every 10 seconds
        intervalId = setInterval(sendEvent, 10000);

        // Clean up when client disconnects
        request.signal.addEventListener('abort', () => {
          cleanup();
          try { controller.close(); } catch (error) {
            logger.error('[NotificationStream] Controller close failed (already closed)', { error: error instanceof Error ? error.message : String(error) });
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
    logger.error('[NotificationStream] Unexpected error', { error: error instanceof Error ? error.message : String(error) });
    return sseErrorResponse('Internal server error');
  }
}

export const dynamic = 'force-dynamic';

/**
 * SSE endpoint for real-time admin notification badges.
 * Streams order count, unread chat count, and alert count every 10s.
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import { logger } from '@/lib/logger';

// Simple rate limiter for SSE connections (max 3 concurrent per IP)
const activeConnections = new Map<string, number>();
const MAX_CONCURRENT_SSE = 3;

async function getNotificationCounts() {
  const [pendingOrders, unreadChats, lowStockCount] = await Promise.all([
    prisma.order.count({
      where: { status: { in: ['PENDING', 'CONFIRMED'] } },
    }).catch(() => 0),
    prisma.chatConversation.count({
      where: { status: { in: ['ACTIVE', 'WAITING_ADMIN'] } },
    }).catch(() => 0),
    prisma.productFormat.count({
      where: {
        isActive: true,
        stockQuantity: { lte: 5 },
      },
    }).catch(() => 0),
  ]);

  return { pendingOrders, unreadChats, lowStockCount };
}

export async function GET(request: NextRequest) {
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
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const currentCount = activeConnections.get(ip) || 0;
  if (currentCount >= MAX_CONCURRENT_SSE) {
    return new Response(JSON.stringify({ error: 'Too many concurrent SSE connections' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
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
}

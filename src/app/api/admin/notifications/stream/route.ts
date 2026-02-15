export const dynamic = 'force-dynamic';

/**
 * SSE endpoint for real-time admin notification badges.
 * Streams order count, unread chat count, and alert count every 10s.
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';

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
    return new Response('Unauthorized', { status: 401 });
  }

  const role = session.user.role as string;
  if (role !== UserRole.EMPLOYEE && role !== UserRole.OWNER) {
    return new Response('Forbidden', { status: 403 });
  }

  const encoder = new TextEncoder();
  let intervalId: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = async () => {
        try {
          const counts = await getNotificationCounts();
          const data = `data: ${JSON.stringify(counts)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          // Connection might be closed
        }
      };

      // Send initial data immediately
      await sendEvent();

      // Then every 10 seconds
      intervalId = setInterval(sendEvent, 10000);

      // Clean up when client disconnects
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      clearInterval(intervalId);
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

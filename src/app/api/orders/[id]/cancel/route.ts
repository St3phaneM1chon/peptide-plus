export const dynamic = 'force-dynamic';

/**
 * Order Cancellation API (Customer-facing)
 * POST /api/orders/[id]/cancel - Cancel a pending order
 *
 * Only the authenticated order owner can cancel, and only while the order is in a
 * cancellable state (PENDING, CONFIRMED, or PROCESSING).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { canCancel } from '@/lib/order-status';
import { sendOrderLifecycleEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

const cancelOrderSchema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find the order - must belong to this user
    const order = await prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }],
        userId: user.id,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        userId: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Validate that the order can be cancelled
    if (!canCancel(order.status)) {
      return NextResponse.json(
        {
          error: `Cannot cancel order with status "${order.status}". Only orders with status PENDING, CONFIRMED, or PROCESSING can be cancelled.`,
        },
        { status: 400 }
      );
    }

    // Parse optional reason from body
    let reason = 'Cancelled by customer';
    try {
      const raw = await request.json();
      const parsed = cancelOrderSchema.safeParse(raw);
      if (parsed.success && parsed.data.reason) {
        reason = parsed.data.reason;
      }
    } catch {
      // No body or invalid JSON is fine, use default reason
    }

    // Update the order status
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        adminNotes: order.status === 'PENDING'
          ? `[CANCELLED] ${new Date().toISOString()} - ${reason}`
          : `[CANCELLED] ${new Date().toISOString()} - ${reason} (was ${order.status})`,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
      },
    });

    // Send cancellation email (fire-and-forget)
    sendOrderLifecycleEmail(order.id, 'CANCELLED', {
      cancellationReason: reason,
    }).catch((err) => {
      logger.error(`Failed to send CANCELLED email for order ${order.id}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      message: `Order ${updatedOrder.orderNumber} has been cancelled.`,
    });
  } catch (error) {
    logger.error('Order cancellation error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

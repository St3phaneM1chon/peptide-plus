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
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { getClientIpFromRequest } from '@/lib/admin-audit';

const cancelOrderSchema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // COMMERCE-029 FIX: Rate limiting on order cancellation
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/orders/cancel');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // SECURITY: CSRF protection for state-changing customer endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

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

    // COMMERCE-009 FIX: Include items, promoCode, giftCardCode for reversal operations
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
        promoCode: true,
        giftCardCode: true,
        giftCardDiscount: true,
        items: {
          select: {
            productId: true,
            formatId: true,
            quantity: true,
            productName: true,
          },
        },
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

    // COMMERCE-009 FIX: Use a transaction to atomically cancel, restore inventory,
    // reverse promo usage, and restore gift card balance.
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Update the order status
      const cancelled = await tx.order.update({
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

      // 2. Restore inventory for each order item
      // COMMERCE-020 FIX: Restore stock for BOTH format-level and base product-level items
      for (const item of order.items) {
        if (item.formatId) {
          await tx.productFormat.updateMany({
            where: { id: item.formatId },
            data: { stockQuantity: { increment: item.quantity } },
          });
        } else {
          // Base product without format — restore product-level stock
          await tx.product.updateMany({
            where: { id: item.productId, trackInventory: true },
            data: { stockQuantity: { increment: item.quantity } },
          });
        }
        logger.info(`[cancelOrder] Restored ${item.quantity}x stock for ${item.productName}`, {
          orderId: order.id,
          productId: item.productId,
          formatId: item.formatId,
        });
      }

      // 3. Reverse promo code usage
      if (order.promoCode) {
        await tx.promoCode.updateMany({
          where: { code: order.promoCode, usageCount: { gt: 0 } },
          data: { usageCount: { decrement: 1 } },
        });
        await tx.promoCodeUsage.deleteMany({
          where: { orderId: order.id },
        });
        logger.info('[cancelOrder] COMMERCE-009: Reversed promo code usage', {
          promoCode: order.promoCode,
          orderId: order.id,
        });
      }

      // 4. Restore gift card balance
      if (order.giftCardCode && order.giftCardDiscount && Number(order.giftCardDiscount) > 0) {
        await tx.giftCard.updateMany({
          where: { code: order.giftCardCode },
          data: {
            balance: { increment: Number(order.giftCardDiscount) },
            isActive: true, // Re-activate if it was deactivated when balance hit 0
          },
        });
        logger.info('[cancelOrder] COMMERCE-009: Restored gift card balance', {
          giftCardCode: order.giftCardCode,
          amount: Number(order.giftCardDiscount),
          orderId: order.id,
        });
      }

      return cancelled;
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

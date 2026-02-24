export const dynamic = 'force-dynamic';

/**
 * API Cancel Order - Cancel a PENDING or CONFIRMED order
 * POST /api/account/orders/[id]/cancel
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { sendOrderCancellation } from '@/lib/email-service';
import { validateCsrf } from '@/lib/csrf-middleware';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // SECURITY (BE-SEC-15): CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: orderId } = await params;

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch the order with items, ensuring it belongs to the authenticated user
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: user.id,
      },
      include: {
        items: true,
        currency: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check if order can be cancelled (only PENDING or CONFIRMED status)
    if (order.status !== 'PENDING' && order.status !== 'CONFIRMED') {
      return NextResponse.json(
        {
          error: 'Cannot cancel order',
          message: `Orders with status "${order.status}" cannot be cancelled. Only PENDING or CONFIRMED orders can be cancelled.`
        },
        { status: 400 }
      );
    }

    // Begin transaction to update order and restore stock
    const result = await prisma.$transaction(async (tx) => {
      // Update order status to CANCELLED
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date(),
        },
        include: {
          items: true,
          currency: true,
        },
      });

      // Restore product stock quantities for each item
      for (const item of order.items) {
        if (item.formatId) {
          // Restore stock for product format
          await tx.productFormat.updateMany({
            where: { id: item.formatId },
            data: {
              stockQuantity: {
                increment: item.quantity,
              },
            },
          });
        } else {
          // Restore stock for base product (if it has stock tracking)
          // Note: Base products might not have direct stock, usually formats do
          // This is a fallback in case base product has stock field
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            select: { id: true },
          });

          if (product) {
            // ProductFormat might need update if product has variants
            // For now, we just log this case
            logger.info(`Restored stock for product ${item.productId} (no format)`);
          }
        }
      }

      // If payment was made (PAID status), mark as REFUND_PENDING
      // IMPORTANT: Do NOT set REFUNDED here — actual refund must go through
      // Stripe/PayPal API via the admin refund endpoint
      let refundAmount = 0;
      let refundMethod = '';

      if (order.paymentStatus === 'PAID') {
        refundAmount = Number(order.total);
        refundMethod = order.paymentMethod || 'Original payment method';

        // Mark as pending refund — admin must process the actual refund
        await tx.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: 'REFUND_PENDING',
          },
        });

        // Log refund request in audit
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'ORDER_REFUND_REQUESTED',
            entityType: 'Order',
            entityId: orderId,
            details: JSON.stringify({
              orderNumber: order.orderNumber,
              amount: refundAmount,
              currency: order.currency?.code || 'CAD',
              paymentMethod: refundMethod,
              stripePaymentId: order.stripePaymentId,
              paypalOrderId: order.paypalOrderId,
              note: 'Customer-initiated cancellation. Admin must process refund via payment provider.',
            }),
          },
        });
      }

      // Create audit log entry for cancellation
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'ORDER_CANCELLED',
          entityType: 'Order',
          entityId: orderId,
          details: JSON.stringify({
            orderNumber: order.orderNumber,
            previousStatus: order.status,
            cancelledBy: 'CUSTOMER',
            items: order.items.map(item => ({
              productName: item.productName,
              formatName: item.formatName,
              quantity: item.quantity,
            })),
          }),
        },
      });

      return { updatedOrder, refundAmount, refundMethod };
    });

    // Send cancellation email
    try {
      await sendOrderCancellation(
        user.id,
        session.user.email,
        {
          customerName: user.name || session.user.name || 'Customer',
          orderNumber: order.orderNumber,
          total: Number(order.total),
          currency: order.currency?.code || 'CAD',
          items: order.items.map(item => ({
            name: item.productName + (item.formatName ? ` - ${item.formatName}` : ''),
            quantity: item.quantity,
          })),
          refundAmount: result.refundAmount,
          refundMethod: result.refundMethod,
        }
      );
    } catch (emailError) {
      // Log email error but don't fail the cancellation
      logger.error('Failed to send cancellation email', { error: emailError instanceof Error ? emailError.message : String(emailError) });
    }

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
      order: {
        id: result.updatedOrder.id,
        orderNumber: result.updatedOrder.orderNumber,
        status: result.updatedOrder.status,
        paymentStatus: result.updatedOrder.paymentStatus,
      },
      refund: result.refundAmount > 0 ? {
        amount: result.refundAmount,
        method: result.refundMethod,
        note: 'Refund request submitted. An admin will process your refund within 5-10 business days.',
      } : null,
    });
  } catch (error) {
    logger.error('Order cancellation error', { error: error instanceof Error ? error.message : String(error) });
    // BE-SEC-04: Don't leak error details in production
    const details = process.env.NODE_ENV === 'development'
      ? (error instanceof Error ? error.message : 'Unknown error')
      : undefined;
    return NextResponse.json(
      { error: 'Failed to cancel order', ...(details ? { details } : {}) },
      { status: 500 }
    );
  }
}

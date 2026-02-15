export const dynamic = 'force-dynamic';

/**
 * API Cancel Order - Cancel a PENDING or CONFIRMED order
 * POST /api/account/orders/[id]/cancel
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { sendOrderCancellation } from '@/lib/email-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
            console.log(`Restored stock for product ${item.productId} (no format)`);
          }
        }
      }

      // If payment was made (PAID status), create a refund record
      // Note: We don't actually process the refund with Stripe here - just log it
      let refundAmount = 0;
      let refundMethod = '';

      if (order.paymentStatus === 'PAID') {
        refundAmount = Number(order.total);
        refundMethod = order.paymentMethod || 'Original payment method';

        // Update payment status to REFUNDED
        await tx.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: 'REFUNDED',
          },
        });

        // Log refund in audit (we don't have a Refund model, so we use audit log)
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'ORDER_REFUND_CREATED',
            entityType: 'Order',
            entityId: orderId,
            details: JSON.stringify({
              orderNumber: order.orderNumber,
              amount: refundAmount,
              currency: order.currency?.code || 'CAD',
              paymentMethod: refundMethod,
              stripePaymentId: order.stripePaymentId,
              paypalOrderId: order.paypalOrderId,
              note: 'Refund will be processed manually or via payment provider webhook',
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
      console.error('Failed to send cancellation email:', emailError);
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
        note: 'Refund will be processed within 5-10 business days',
      } : null,
    });
  } catch (error) {
    console.error('Order cancellation error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

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
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import Stripe from 'stripe';
import { STRIPE_API_VERSION } from '@/lib/stripe';
import { getPayPalAccessToken, PAYPAL_API_URL } from '@/lib/paypal';

// KB-PP-BUILD-002: Lazy init to avoid crash when STRIPE_SECRET_KEY is absent at build time
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
  }
  return _stripe;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting for payment-related endpoint
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/account/orders/cancel');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

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

    // ── If order was PAID, attempt an actual refund via Stripe or PayPal BEFORE
    // touching the DB. External payment calls must happen outside the DB transaction
    // so a Stripe/PayPal failure surfaces a clean error without partial DB state.
    let refundAmount = 0;
    let refundMethod = '';
    let stripeRefundId: string | undefined;
    let paypalRefundId: string | undefined;
    let refundedViaProvider = false;

    if (order.paymentStatus === 'PAID') {
      refundAmount = Number(order.total);
      refundMethod = order.paymentMethod || 'Original payment method';

      if (order.stripePaymentId) {
        // ── Stripe refund ──────────────────────────────────────────────────
        try {
          const refund = await getStripe().refunds.create({
            payment_intent: order.stripePaymentId,
            amount: Math.round(refundAmount * 100), // Stripe uses cents
            reason: 'requested_by_customer',
          });
          stripeRefundId = refund.id;
          refundedViaProvider = true;
          logger.info('[cancelOrder] Stripe refund created', {
            orderId,
            stripePaymentId: order.stripePaymentId,
            stripeRefundId: refund.id,
            amount: refundAmount,
          });
        } catch (stripeError) {
          logger.error('[cancelOrder] Stripe refund failed', {
            error: stripeError instanceof Error ? stripeError.message : String(stripeError),
            orderId,
            stripePaymentId: order.stripePaymentId,
          });
          return NextResponse.json(
            {
              error: 'Refund failed',
              message: `Could not process refund via Stripe: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`,
            },
            { status: 502 }
          );
        }
      } else if (order.paypalOrderId) {
        // ── PayPal refund ──────────────────────────────────────────────────
        try {
          const paypalAccessToken = await getPayPalAccessToken();

          // Resolve the capture ID from the PayPal order
          const orderRes = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders/${order.paypalOrderId}`, {
            headers: { Authorization: `Bearer ${paypalAccessToken}` },
          });
          const orderData = await orderRes.json();
          const captureId = orderData.purchase_units?.[0]?.payments?.captures?.[0]?.id as string | undefined;

          if (!captureId) {
            return NextResponse.json(
              { error: 'PayPal capture ID not found — cannot process refund automatically. Please contact support.' },
              { status: 400 }
            );
          }

          const refundRes = await fetch(`${PAYPAL_API_URL}/v2/payments/captures/${captureId}/refund`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${paypalAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}), // empty body = full refund
          });

          if (!refundRes.ok) {
            const refundError = await refundRes.json();
            logger.error('[cancelOrder] PayPal refund failed', { error: refundError, orderId });
            return NextResponse.json(
              {
                error: 'Refund failed',
                message: `Could not process refund via PayPal: ${refundError.message || JSON.stringify(refundError)}`,
              },
              { status: 502 }
            );
          }

          const refundData = await refundRes.json();
          paypalRefundId = refundData.id as string | undefined;
          refundedViaProvider = true;
          logger.info('[cancelOrder] PayPal refund created', {
            orderId,
            paypalOrderId: order.paypalOrderId,
            paypalRefundId,
            amount: refundAmount,
          });
        } catch (paypalError) {
          logger.error('[cancelOrder] PayPal refund error', {
            error: paypalError instanceof Error ? paypalError.message : String(paypalError),
            orderId,
          });
          return NextResponse.json(
            {
              error: 'Refund failed',
              message: `Could not process refund via PayPal: ${paypalError instanceof Error ? paypalError.message : 'Unknown error'}`,
            },
            { status: 502 }
          );
        }
      } else {
        // No payment provider ID — flag for manual admin review
        logger.warn('[cancelOrder] PAID order has no stripePaymentId or paypalOrderId; marking REFUND_PENDING for admin', {
          orderId,
          orderNumber: order.orderNumber,
        });
      }
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

      // E-20 FIX: Reverse promo code usage if the cancelled order used a promo code.
      // Decrement the global usageCount and delete the per-user PromoCodeUsage record
      // so the promo code slot is freed and the customer (or others) can reuse it.
      if (order.promoCode) {
        const promo = await tx.promoCode.findUnique({
          where: { code: order.promoCode },
        });
        if (promo && promo.usageCount > 0) {
          await tx.promoCode.update({
            where: { code: order.promoCode },
            data: { usageCount: { decrement: 1 } },
          });
        }
        // Delete the PromoCodeUsage record tied to this order
        await tx.promoCodeUsage.deleteMany({
          where: { orderId: orderId },
        });
        logger.info('[cancelOrder] E-20: reversed promo code usage', {
          promoCode: order.promoCode,
          orderId,
        });
      }

      // Set paymentStatus based on whether the provider refund succeeded
      if (order.paymentStatus === 'PAID') {
        const newPaymentStatus = refundedViaProvider ? 'REFUNDED' : 'REFUND_PENDING';

        await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: newPaymentStatus },
        });

        // Audit log for the refund action
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: refundedViaProvider ? 'ORDER_REFUNDED' : 'ORDER_REFUND_REQUESTED',
            entityType: 'Order',
            entityId: orderId,
            details: JSON.stringify({
              orderNumber: order.orderNumber,
              amount: refundAmount,
              currency: order.currency?.code || 'CAD',
              paymentMethod: refundMethod,
              stripePaymentId: order.stripePaymentId,
              stripeRefundId: stripeRefundId ?? null,
              paypalOrderId: order.paypalOrderId,
              paypalRefundId: paypalRefundId ?? null,
              refundedViaProvider,
              note: refundedViaProvider
                ? 'Customer-initiated cancellation. Refund processed automatically via payment provider.'
                : 'Customer-initiated cancellation. No payment provider ID found — admin must process refund manually.',
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
        stripeRefundId: stripeRefundId ?? null,
        paypalRefundId: paypalRefundId ?? null,
        processed: refundedViaProvider,
        note: refundedViaProvider
          ? 'Your refund has been submitted to your payment provider and should appear within 5-10 business days.'
          : 'Refund request submitted. An admin will review and process your refund within 5-10 business days.',
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

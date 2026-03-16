export const dynamic = 'force-dynamic';

/**
 * Order Cancellation API (Customer-facing)
 * POST /api/orders/[id]/cancel - Cancel a pending order
 *
 * Only the authenticated order owner can cancel, and only while the order is in a
 * cancellable state (PENDING, CONFIRMED, or PROCESSING).
 *
 * PURCHASE-WORKFLOW FIX: If the order was already paid, this route now initiates
 * a full refund via Stripe or PayPal, creates refund accounting entries (journal
 * entry + credit note), claws back ambassador commissions, revokes loyalty points,
 * and updates paymentStatus accordingly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Stripe from 'stripe';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { STRIPE_API_VERSION } from '@/lib/stripe';
import { getPayPalAccessToken, PAYPAL_API_URL } from '@/lib/paypal';
import { canCancel } from '@/lib/order-status';
import { sendOrderLifecycleEmail } from '@/lib/email';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { getClientIpFromRequest } from '@/lib/admin-audit';
import {
  createRefundAccountingEntries,
  createCreditNote,
} from '@/lib/accounting/webhook-accounting.service';
import { clawbackAmbassadorCommission } from '@/lib/ambassador-commission';

// KB-PP-BUILD-002: Lazy init to avoid crash when STRIPE_SECRET_KEY is absent at build time
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
  }
  return _stripe;
}

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
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
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
      select: { id: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // COMMERCE-009 FIX: Include items, promoCode, giftCardCode for reversal operations
    // PURCHASE-WORKFLOW FIX: Also fetch payment-related fields for refund processing
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
        paymentStatus: true,
        paymentMethod: true,
        total: true,
        taxTps: true,
        taxTvq: true,
        taxTvh: true,
        taxPst: true,
        stripePaymentId: true,
        paypalOrderId: true,
        shippingName: true,
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
        currency: {
          select: { code: true },
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
    } catch (bodyErr) {
      logger.error('[orders/cancel] Body parse failed, using default reason', { error: bodyErr instanceof Error ? bodyErr.message : String(bodyErr) });
    }

    // ── PURCHASE-WORKFLOW FIX: If the order was PAID, initiate refund via the
    // payment provider BEFORE touching the DB. External payment calls must happen
    // outside the DB transaction so a Stripe/PayPal failure surfaces a clean error
    // without partial DB state.
    let refundAmount = 0;
    let refundMethod = '';
    let stripeRefundId: string | undefined;
    let paypalRefundId: string | undefined;
    let refundedViaProvider = false;

    if (order.paymentStatus === 'PAID') {
      // RACE CONDITION FIX: Atomically claim the refund by transitioning PAID → REFUNDING.
      // If another concurrent request already claimed it, updateMany returns count=0.
      const claimResult = await prisma.order.updateMany({
        where: { id: order.id, paymentStatus: 'PAID' },
        data: { paymentStatus: 'REFUNDING' },
      });

      if (claimResult.count === 0) {
        // Another request already started the refund — don't issue a duplicate
        return NextResponse.json(
          { error: 'Refund already in progress for this order' },
          { status: 409 }
        );
      }

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
            orderId: order.id,
            stripePaymentId: order.stripePaymentId,
            stripeRefundId: refund.id,
            amount: refundAmount,
          });
        } catch (stripeError) {
          // Revert REFUNDING → PAID so customer can retry
          await prisma.order.updateMany({ where: { id: order.id, paymentStatus: 'REFUNDING' }, data: { paymentStatus: 'PAID' } });
          logger.error('[cancelOrder] Stripe refund failed, reverted to PAID', {
            error: stripeError instanceof Error ? stripeError.message : String(stripeError),
            orderId: order.id,
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
            // Revert REFUNDING → PAID so customer can retry or admin can process
            await prisma.order.updateMany({ where: { id: order.id, paymentStatus: 'REFUNDING' }, data: { paymentStatus: 'PAID' } });
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
            // Revert REFUNDING → PAID so customer can retry
            await prisma.order.updateMany({ where: { id: order.id, paymentStatus: 'REFUNDING' }, data: { paymentStatus: 'PAID' } });
            logger.error('[cancelOrder] PayPal refund failed, reverted to PAID', { error: refundError, orderId: order.id });
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
            orderId: order.id,
            paypalOrderId: order.paypalOrderId,
            paypalRefundId,
            amount: refundAmount,
          });
        } catch (paypalError) {
          // Revert REFUNDING → PAID so customer can retry
          await prisma.order.updateMany({ where: { id: order.id, paymentStatus: 'REFUNDING' }, data: { paymentStatus: 'PAID' } });
          logger.error('[cancelOrder] PayPal refund error, reverted to PAID', {
            error: paypalError instanceof Error ? paypalError.message : String(paypalError),
            orderId: order.id,
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
          orderId: order.id,
          orderNumber: order.orderNumber,
        });
      }
    }

    // COMMERCE-009 FIX: Use a transaction to atomically cancel, restore inventory,
    // reverse promo usage, restore gift card balance, and update payment status.
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Update the order status (and paymentStatus if a paid order)
      const newPaymentStatus = order.paymentStatus === 'PAID'
        ? (refundedViaProvider ? 'REFUNDED' : 'REFUND_PENDING')
        : undefined;

      const cancelled = await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          ...(newPaymentStatus ? { paymentStatus: newPaymentStatus } : {}),
          adminNotes: order.status === 'PENDING'
            ? `[CANCELLED] ${new Date().toISOString()} - ${reason}`
            : `[CANCELLED] ${new Date().toISOString()} - ${reason} (was ${order.status})`,
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
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

    // ── PURCHASE-WORKFLOW FIX: Post-transaction accounting & side-effects for refunded orders
    let refundAccountingEntryId: string | null = null;
    let refundCreditNoteId: string | null = null;

    if (order.paymentStatus === 'PAID' && refundedViaProvider) {
      // Calculate proportional tax refund
      const orderTotal = Number(order.total);
      const refundTps = Math.round(Number(order.taxTps) * 100) / 100;
      const refundTvq = Math.round(Number(order.taxTvq) * 100) / 100;
      const refundTvh = Math.round(Number(order.taxTvh) * 100) / 100;
      const refundPst = Math.round(Number(order.taxPst || 0) * 100) / 100;

      // Create refund journal entry (runs its own internal transaction)
      try {
        refundAccountingEntryId = await createRefundAccountingEntries(
          order.id,
          refundAmount,
          refundTps,
          refundTvq,
          refundTvh,
          `Customer cancellation: ${reason}`,
          refundPst,
        );
        logger.info('[cancelOrder] Refund accounting entry created', {
          orderId: order.id,
          entryId: refundAccountingEntryId,
        });
      } catch (accError) {
        logger.error('[cancelOrder] Failed to create refund accounting entries (non-blocking)', {
          orderId: order.id,
          error: accError instanceof Error ? accError.message : String(accError),
        });
      }

      // Create credit note (runs its own internal transaction)
      if (refundAccountingEntryId) {
        try {
          const [invoice, customer] = await Promise.all([
            prisma.customerInvoice.findFirst({
              where: { orderId: order.id },
              select: { id: true },
            }),
            prisma.user.findUnique({
              where: { id: order.userId ?? undefined },
              select: { name: true, email: true },
            }),
          ]);

          const netRefund = refundAmount - refundTps - refundTvq - refundTvh - refundPst;
          refundCreditNoteId = await createCreditNote({
            orderId: order.id,
            invoiceId: invoice?.id,
            customerName: customer?.name || order.shippingName || 'Client',
            customerEmail: customer?.email,
            subtotal: netRefund,
            taxTps: refundTps,
            taxTvq: refundTvq,
            taxTvh: refundTvh,
            taxPst: refundPst,
            total: refundAmount,
            reason: `Customer cancellation: ${reason}`,
            journalEntryId: refundAccountingEntryId,
            issuedBy: 'system',
          });
          logger.info('[cancelOrder] Credit note created', {
            orderId: order.id,
            creditNoteId: refundCreditNoteId,
          });
        } catch (cnError) {
          logger.error('[cancelOrder] Failed to create credit note (non-blocking)', {
            orderId: order.id,
            error: cnError instanceof Error ? cnError.message : String(cnError),
          });
        }
      }

      // Clawback ambassador commission (fire-and-forget)
      clawbackAmbassadorCommission(
        order.id,
        orderTotal,
        orderTotal,
        true, // full cancellation
      ).catch((commError) => {
        logger.error('[cancelOrder] Failed to clawback ambassador commission', {
          error: commError instanceof Error ? commError.message : String(commError),
          orderId: order.id,
        });
      });

      // Revoke loyalty points awarded for this order (fire-and-forget)
      if (order.userId) {
        (async () => {
          try {
            const earnTransactions = await prisma.loyaltyTransaction.findMany({
              where: {
                orderId: order.id,
                type: { in: ['EARN_PURCHASE', 'EARN_BONUS'] },
                points: { gt: 0 },
              },
              select: { id: true, points: true },
            });

            const totalEarnedPoints = earnTransactions.reduce((sum, t) => sum + t.points, 0);

            if (totalEarnedPoints > 0) {
              await prisma.$transaction(async (tx) => {
                const updatedUser = await tx.user.update({
                  where: { id: order.userId! },
                  data: { loyaltyPoints: { decrement: totalEarnedPoints } },
                });

                if (updatedUser.loyaltyPoints < 0) {
                  await tx.user.update({
                    where: { id: order.userId! },
                    data: { loyaltyPoints: 0 },
                  });
                }

                const finalBalance = Math.max(updatedUser.loyaltyPoints, 0);

                await tx.loyaltyTransaction.create({
                  data: {
                    userId: order.userId!,
                    type: 'ADJUST',
                    points: -totalEarnedPoints,
                    description: `Points revoked: order ${order.orderNumber} cancelled and refunded ($${refundAmount})`,
                    orderId: order.id,
                    balanceAfter: finalBalance,
                    metadata: JSON.stringify({
                      reason: 'cancellation_refund_revocation',
                      refundAmount,
                      originalPointsEarned: totalEarnedPoints,
                    }),
                  },
                });
              });

              logger.info('[cancelOrder] Loyalty points revoked', {
                orderId: order.id,
                userId: order.userId,
                pointsRevoked: totalEarnedPoints,
              });
            }
          } catch (loyaltyError) {
            logger.error('[cancelOrder] Failed to revoke loyalty points', {
              orderId: order.id,
              error: loyaltyError instanceof Error ? loyaltyError.message : String(loyaltyError),
            });
          }
        })();
      }

      // Send refund-specific email (fire-and-forget)
      sendOrderLifecycleEmail(order.id, 'REFUNDED', {
        refundAmount,
        refundIsPartial: false,
      }).catch((err) => {
        logger.error(`Failed to send REFUNDED email for order ${order.id}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

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
      refund: refundAmount > 0 ? {
        amount: refundAmount,
        method: refundMethod,
        stripeRefundId: stripeRefundId ?? null,
        paypalRefundId: paypalRefundId ?? null,
        processed: refundedViaProvider,
        accountingEntryId: refundAccountingEntryId,
        creditNoteId: refundCreditNoteId,
        note: refundedViaProvider
          ? 'Your refund has been submitted to your payment provider and should appear within 5-10 business days.'
          : 'Refund request submitted. An admin will review and process your refund within 5-10 business days.',
      } : null,
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

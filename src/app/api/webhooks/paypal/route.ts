export const dynamic = 'force-dynamic';

/**
 * PayPal Webhook Handler
 * Handles payment events from PayPal with idempotence via WebhookEvent model
 *
 * Events handled:
 * - PAYMENT.CAPTURE.COMPLETED: Create order, accounting entries, consume inventory
 * - PAYMENT.CAPTURE.REFUNDED: Update order, create refund entries, restore stock
 * - PAYMENT.CAPTURE.DENIED: Update order status
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { validateTransition } from '@/lib/order-status-machine';
import { createAccountingEntriesForOrder, createRefundAccountingEntries } from '@/lib/accounting/webhook-accounting.service';
import { consumeReservation } from '@/lib/inventory';
import { getPayPalAccessToken, PAYPAL_API_URL } from '@/lib/paypal';
import { sanitizeWebhookPayload } from '@/lib/sanitize';
import { clawbackAmbassadorCommission } from '@/lib/ambassador-commission';
import { applyRate } from '@/lib/decimal-calculator';

/** PayPal webhook event structure (deeply nested, partially typed for safety) */
interface PayPalWebhookEvent {
  event_type: string;
  resource: {
    id: string;
    amount?: { value?: string; currency_code?: string };
    supplementary_data?: { related_ids?: { order_id?: string } };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Verify PayPal webhook signature
 */
async function verifyWebhookSignature(
  request: NextRequest,
  body: string
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    logger.error('PAYPAL_WEBHOOK_ID is not configured', { webhookId: undefined });
    return false;
  }

  const transmissionId = request.headers.get('paypal-transmission-id');
  const transmissionTime = request.headers.get('paypal-transmission-time');
  const certUrl = request.headers.get('paypal-cert-url');
  const authAlgo = request.headers.get('paypal-auth-algo');
  const transmissionSig = request.headers.get('paypal-transmission-sig');

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    logger.error('Missing PayPal webhook headers', { webhookId });
    return false;
  }

  try {
    const accessToken = await getPayPalAccessToken();

    const verifyResponse = await fetch(
      `${PAYPAL_API_URL}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: webhookId,
          webhook_event: JSON.parse(body),
        }),
      }
    );

    const verifyData = await verifyResponse.json();
    // A9-P2-006 FIX: Use timing-safe comparison for the verification status
    // to prevent timing side-channel attacks on the webhook verification result.
    const status = String(verifyData.verification_status || '');
    const expected = 'SUCCESS';
    if (status.length !== expected.length) return false;
    return crypto.timingSafeEqual(
      Buffer.from(status),
      Buffer.from(expected)
    );
  } catch (error) {
    logger.error('PayPal webhook verification error', {
      webhookId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const event = JSON.parse(body);

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(request, body);
    if (!isValid) {
      logger.error('PayPal webhook signature verification failed', { webhookId: event?.id });
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
    }

    const eventId = event.id;
    const eventType = event.event_type;

    logger.info('PayPal webhook received', { webhookId: eventId, eventType });

    // Idempotence check: skip if already processed
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventId },
    });

    if (existingEvent) {
      logger.info('PayPal webhook already processed', { webhookId: eventId, status: existingEvent.status });
      return NextResponse.json({ received: true, status: 'already_processed' });
    }

    // Record the webhook event as PROCESSING
    // BE-SEC-20: Sanitize PCI/PII-sensitive fields before storing payload
    const sanitizedPayload = JSON.stringify(sanitizeWebhookPayload(event));
    const webhookRecord = await prisma.webhookEvent.create({
      data: {
        eventId,
        provider: 'paypal',
        eventType,
        status: 'PROCESSING',
        payload: sanitizedPayload,
      },
    });

    try {
      switch (eventType) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          await handleCaptureCompleted(event, webhookRecord.id);
          break;

        case 'PAYMENT.CAPTURE.REFUNDED':
          await handleCaptureRefunded(event, webhookRecord.id);
          break;

        case 'PAYMENT.CAPTURE.DENIED':
          await handleCaptureDenied(event, webhookRecord.id);
          break;

        default:
          logger.warn('Unhandled PayPal event type', { webhookId: eventId, eventType });
      }

      // Mark as completed
      await prisma.webhookEvent.update({
        where: { id: webhookRecord.id },
        data: { status: 'COMPLETED', processedAt: new Date() },
      });
    } catch (handlerError) {
      logger.error('PayPal webhook handler error', {
        webhookId: eventId,
        eventType,
        error: handlerError instanceof Error ? handlerError.message : String(handlerError),
      });

      await prisma.webhookEvent.update({
        where: { id: webhookRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: handlerError instanceof Error ? handlerError.message : 'Unknown error',
          processedAt: new Date(),
        },
      });

      // Still return 200 to PayPal so they don't retry endlessly
      // The error is logged and the event status is FAILED for manual review

      // TODO (item 72): Implement webhook retry mechanism for PayPal
      // Same retry logic as Stripe webhook: track retryCount on WebhookEvent,
      // use cron job /api/cron/retry-webhooks to reprocess FAILED events
      // with retryCount < 3 using exponential backoff (5s, 10s, 20s).
      // After max retries, send admin notification for manual intervention.
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('PayPal webhook error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

/**
 * Handle PAYMENT.CAPTURE.COMPLETED
 * - Find or create the order
 * - Mark as paid
 * - Create accounting entries
 * - Consume inventory reservations
 */
async function handleCaptureCompleted(event: PayPalWebhookEvent, webhookRecordId: string) {
  const capture = event.resource;
  const paypalOrderId = capture.supplementary_data?.related_ids?.order_id || capture.id;
  const amount = parseFloat(capture.amount?.value || '0');
  const currencyCode = capture.amount?.currency_code || 'CAD';

  logger.info('PayPal capture completed', { paymentId: capture.id, orderId: paypalOrderId, amount, currencyCode });

  // Find the order by paypalOrderId
  let order = await prisma.order.findFirst({
    where: { paypalOrderId },
  });

  if (!order) {
    logger.warn('Order not found for PayPal order', { orderId: paypalOrderId });
    return;
  }

  // Validate transition (webhook: log warning but proceed — PayPal data is authoritative)
  const confirmTransition = validateTransition(order.status, 'CONFIRMED');
  if (!confirmTransition.valid) {
    logger.warn('[paypal-webhook] Unexpected capture transition (proceeding anyway)', {
      orderId: order.id,
      currentStatus: order.status,
      targetStatus: 'CONFIRMED',
      reason: confirmTransition.error,
    });
  }

  // Update order status to paid
  order = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      paypalOrderId,
    },
  });

  // Update webhook record with order link
  await prisma.webhookEvent.update({
    where: { id: webhookRecordId },
    data: { orderId: order.id },
  });

  // Create accounting entries
  try {
    const accounting = await createAccountingEntriesForOrder(order.id);
    logger.info('Accounting entries created', { orderId: order.id, orderNumber: order.orderNumber, saleEntryId: accounting.saleEntryId, feeEntryId: accounting.feeEntryId });
  } catch (accError) {
    logger.error('Failed to create accounting entries', { orderId: order.id, error: accError instanceof Error ? accError.message : String(accError) });
    // Don't throw - order is still valid even if accounting fails
  }

  // A8-P2-003 FIX: Consume inventory reservations using the paypalOrderId-based
  // cartId that was set during create-order. Without the cartId, consumeReservation
  // searched by orderId which found nothing (reservations don't have orderId set
  // until consumption), so stock was never decremented.
  try {
    await consumeReservation(order.id, `paypal:${paypalOrderId}`);
    logger.info('Inventory consumed', { orderId: order.id, orderNumber: order.orderNumber });
  } catch (invError) {
    logger.error('Failed to consume inventory', { orderId: order.id, error: invError instanceof Error ? invError.message : String(invError) });
    // Don't throw - order is still valid even if inventory consumption fails
  }

  // Create ambassador commission if the order used a referral code
  try {
    await createAmbassadorCommission(order.id, order.orderNumber, Number(order.total), order.promoCode);
  } catch (commError) {
    logger.error('Failed to create ambassador commission', { orderId: order.id, error: commError instanceof Error ? commError.message : String(commError) });
    // Don't throw - order is still valid even if commission creation fails
  }
}

/**
 * Handle PAYMENT.CAPTURE.REFUNDED
 * - Update order payment status
 * - Create refund accounting entries
 * - Restore stock via RETURN inventory transactions
 */
async function handleCaptureRefunded(event: PayPalWebhookEvent, webhookRecordId: string) {
  const capture = event.resource;
  const paypalOrderId = capture.supplementary_data?.related_ids?.order_id || capture.id;
  const refundAmount = parseFloat(capture.amount?.value || '0');

  logger.info('PayPal capture refunded', { paymentId: capture.id, orderId: paypalOrderId, refundAmount });

  // Find the order
  const order = await prisma.order.findFirst({
    where: { paypalOrderId },
    include: { items: true },
  });

  if (!order) {
    logger.warn('Order not found for PayPal refund', { orderId: paypalOrderId });
    return;
  }

  // Determine if full or partial refund
  const orderTotal = Number(order.total);
  const isFullRefund = refundAmount >= orderTotal;

  // Validate transition (webhook: log warning but proceed — PayPal data is authoritative)
  if (isFullRefund) {
    const refundTransition = validateTransition(order.status, 'CANCELLED');
    if (!refundTransition.valid) {
      logger.warn('[paypal-webhook] Unexpected refund transition (proceeding anyway)', {
        orderId: order.id,
        currentStatus: order.status,
        targetStatus: 'CANCELLED',
        reason: refundTransition.error,
      });
    }
  }

  // Update order status
  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: isFullRefund ? 'REFUNDED' : 'PARTIAL_REFUND',
      status: isFullRefund ? 'CANCELLED' : order.status,
    },
  });

  // Update webhook record
  await prisma.webhookEvent.update({
    where: { id: webhookRecordId },
    data: { orderId: order.id },
  });

  // Create refund accounting entries
  try {
    // Calculate proportional tax refund using Decimal arithmetic
    const refundRatio = refundAmount / orderTotal;
    const refundTps = applyRate(Number(order.taxTps), refundRatio);
    const refundTvq = applyRate(Number(order.taxTvq), refundRatio);
    const refundTvh = applyRate(Number(order.taxTvh), refundRatio);

    await createRefundAccountingEntries(
      order.id,
      refundAmount,
      refundTps,
      refundTvq,
      refundTvh,
      'PayPal refund'
    );
    logger.info('Refund accounting entries created', { orderId: order.id, orderNumber: order.orderNumber });
  } catch (accError) {
    logger.error('Failed to create refund accounting entries', { orderId: order.id, error: accError instanceof Error ? accError.message : String(accError) });
  }

  // Restore stock for full refunds
  // BUG 9: Wrap stock restoration in a transaction for atomicity
  if (isFullRefund) {
    try {
      await prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          if (item.optionId) {
            await tx.productOption.update({
              where: { id: item.optionId },
              data: { stockQuantity: { increment: item.quantity } },
            });
          } else {
            // A8-P2-003 + E-07 FIX: Also restore stock for base products (no optionId)
            await tx.product.updateMany({
              where: { id: item.productId, trackInventory: true },
              data: { stockQuantity: { increment: item.quantity } },
            });
          }

          // Get current WAC
          const lastTransaction = await tx.inventoryTransaction.findFirst({
            where: {
              productId: item.productId,
              optionId: item.optionId,
            },
            orderBy: { createdAt: 'desc' },
            select: { runningWAC: true },
          });
          const wac = lastTransaction ? Number(lastTransaction.runningWAC) : 0;

          // Create RETURN inventory transaction
          await tx.inventoryTransaction.create({
            data: {
              productId: item.productId,
              optionId: item.optionId,
              type: 'RETURN',
              quantity: item.quantity,
              unitCost: wac,
              runningWAC: wac,
              orderId: order.id,
              reason: 'PayPal refund - stock restored',
            },
          });
        }
      });
      logger.info('Stock restored for refunded order', { orderId: order.id, orderNumber: order.orderNumber });
    } catch (invError) {
      logger.error('Failed to restore stock', { orderId: order.id, error: invError instanceof Error ? invError.message : String(invError) });
    }
  }

  // Clawback ambassador commission on refund (P2 #28 fix)
  try {
    const result = await clawbackAmbassadorCommission(
      order.id,
      refundAmount,
      orderTotal,
      isFullRefund
    );
    if (result.clawbackAmount && result.clawbackAmount > 0) {
      logger.info('Ambassador commission clawback on PayPal refund', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        clawbackAmount: result.clawbackAmount,
        wasPaidOut: result.wasPaidOut,
      });
    }
  } catch (commError) {
    logger.error('Failed to clawback ambassador commission', {
      orderId: order.id,
      error: commError instanceof Error ? commError.message : String(commError),
    });
  }

  // A5-P1-003: Revoke loyalty points awarded for this order on refund
  if (order.userId) {
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
        const pointsToRevoke = isFullRefund
          ? totalEarnedPoints
          : Math.floor(totalEarnedPoints * (refundAmount / orderTotal));

        if (pointsToRevoke > 0) {
          await prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
              where: { id: order.userId! },
              data: {
                loyaltyPoints: { decrement: pointsToRevoke },
              },
            });

            // Prevent negative balance
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
                points: -pointsToRevoke,
                description: `Points revoked: order ${order.orderNumber} refunded via PayPal ($${refundAmount}${isFullRefund ? ' - full' : ' - partial'})`,
                orderId: order.id,
                balanceAfter: finalBalance,
                metadata: JSON.stringify({
                  reason: 'refund_revocation',
                  refundAmount,
                  isFullRefund,
                  originalPointsEarned: totalEarnedPoints,
                  source: 'paypal_webhook',
                }),
              },
            });
          });

          logger.info('Loyalty points revoked on PayPal refund', {
            orderId: order.id,
            userId: order.userId,
            pointsRevoked: pointsToRevoke,
          });
        }
      }
    } catch (loyaltyError) {
      logger.error('Failed to revoke loyalty points on PayPal refund', {
        orderId: order.id,
        error: loyaltyError instanceof Error ? loyaltyError.message : String(loyaltyError),
      });
    }
  }
}

/**
 * Handle PAYMENT.CAPTURE.DENIED
 * - Update order status to failed
 */
async function handleCaptureDenied(event: PayPalWebhookEvent, webhookRecordId: string) {
  const capture = event.resource;
  const paypalOrderId = capture.supplementary_data?.related_ids?.order_id || capture.id;

  logger.info('PayPal capture denied', { paymentId: capture.id, orderId: paypalOrderId });

  const order = await prisma.order.findFirst({
    where: { paypalOrderId },
  });

  if (!order) {
    logger.warn('Order not found for PayPal denied capture', { orderId: paypalOrderId });
    return;
  }

  // Validate transition (webhook: log warning but proceed — PayPal data is authoritative)
  const deniedTransition = validateTransition(order.status, 'CANCELLED');
  if (!deniedTransition.valid) {
    logger.warn('[paypal-webhook] Unexpected denied transition (proceeding anyway)', {
      orderId: order.id,
      currentStatus: order.status,
      targetStatus: 'CANCELLED',
      reason: deniedTransition.error,
    });
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: 'FAILED',
      status: 'CANCELLED',
    },
  });

  await prisma.webhookEvent.update({
    where: { id: webhookRecordId },
    data: { orderId: order.id },
  });

  logger.info('Order marked as failed (PayPal capture denied)', { orderId: order.id, orderNumber: order.orderNumber });
}

/**
 * Create an ambassador commission record when a paid order used a referral code.
 * Silently skips if the promo code doesn't match an ambassador or if a commission already exists.
 */
async function createAmbassadorCommission(
  orderId: string,
  orderNumber: string,
  orderTotal: number,
  promoCode: string | null
) {
  if (!promoCode) return;

  const ambassador = await prisma.ambassador.findUnique({
    where: { referralCode: promoCode },
  });

  if (!ambassador || ambassador.status !== 'ACTIVE') return;

  const rate = Number(ambassador.commissionRate);
  // F-010 FIX: commissionRate is stored as an integer percentage (e.g. 10 = 10%).
  // Divide by 100 first to get the decimal multiplier, then round to 2 decimal places.
  const commissionAmount = applyRate(orderTotal, rate / 100);

  // Use upsert to avoid duplicates (idempotent for webhook retries)
  await prisma.ambassadorCommission.upsert({
    where: {
      ambassadorId_orderId: {
        ambassadorId: ambassador.id,
        orderId,
      },
    },
    create: {
      ambassadorId: ambassador.id,
      orderId,
      orderNumber,
      orderTotal,
      commissionRate: rate,
      commissionAmount,
    },
    update: {}, // No-op if already exists
  });

  logger.info('Ambassador commission created', { orderId, orderNumber, commissionAmount, ambassadorName: ambassador.name });
}

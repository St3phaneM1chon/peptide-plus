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
import { prisma } from '@/lib/db';
import { createAccountingEntriesForOrder, createRefundAccountingEntries } from '@/lib/accounting/webhook-accounting.service';
import { consumeReservation } from '@/lib/inventory';

const PAYPAL_API_URL = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

/**
 * Verify PayPal webhook signature
 */
async function verifyWebhookSignature(
  request: NextRequest,
  body: string
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.error('PAYPAL_WEBHOOK_ID is not configured');
    return false;
  }

  const transmissionId = request.headers.get('paypal-transmission-id');
  const transmissionTime = request.headers.get('paypal-transmission-time');
  const certUrl = request.headers.get('paypal-cert-url');
  const authAlgo = request.headers.get('paypal-auth-algo');
  const transmissionSig = request.headers.get('paypal-transmission-sig');

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    console.error('Missing PayPal webhook headers');
    return false;
  }

  try {
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');

    const tokenResponse = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

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
    return verifyData.verification_status === 'SUCCESS';
  } catch (error) {
    console.error('PayPal webhook verification error:', error);
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
      console.error('PayPal webhook signature verification failed');
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
    }

    const eventId = event.id;
    const eventType = event.event_type;

    console.log(`PayPal webhook received: ${eventType} (${eventId})`);

    // Idempotence check: skip if already processed
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventId },
    });

    if (existingEvent) {
      console.log(`PayPal webhook ${eventId} already processed (status: ${existingEvent.status})`);
      return NextResponse.json({ received: true, status: 'already_processed' });
    }

    // Record the webhook event as PROCESSING
    const webhookRecord = await prisma.webhookEvent.create({
      data: {
        eventId,
        provider: 'paypal',
        eventType,
        status: 'PROCESSING',
        payload: body,
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
          console.log(`Unhandled PayPal event type: ${eventType}`);
      }

      // Mark as completed
      await prisma.webhookEvent.update({
        where: { id: webhookRecord.id },
        data: { status: 'COMPLETED', processedAt: new Date() },
      });
    } catch (handlerError) {
      console.error(`PayPal webhook handler error for ${eventType}:`, handlerError);

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
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('PayPal webhook error:', error);
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
async function handleCaptureCompleted(event: any, webhookRecordId: string) {
  const capture = event.resource;
  const paypalOrderId = capture.supplementary_data?.related_ids?.order_id || capture.id;
  const amount = parseFloat(capture.amount?.value || '0');
  const currencyCode = capture.amount?.currency_code || 'CAD';

  console.log(`PayPal capture completed: ${paypalOrderId}, amount: ${amount} ${currencyCode}`);

  // Find the order by paypalOrderId
  let order = await prisma.order.findFirst({
    where: { paypalOrderId },
  });

  if (!order) {
    console.warn(`Order not found for PayPal order ${paypalOrderId}, skipping`);
    return;
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
    console.log(`Accounting entries created for order ${order.orderNumber}: sale=${accounting.saleEntryId}, fee=${accounting.feeEntryId}`);
  } catch (accError) {
    console.error(`Failed to create accounting entries for order ${order.id}:`, accError);
    // Don't throw - order is still valid even if accounting fails
  }

  // Consume inventory reservations
  try {
    await consumeReservation(order.id);
    console.log(`Inventory consumed for order ${order.orderNumber}`);
  } catch (invError) {
    console.error(`Failed to consume inventory for order ${order.id}:`, invError);
    // Don't throw - order is still valid even if inventory consumption fails
  }
}

/**
 * Handle PAYMENT.CAPTURE.REFUNDED
 * - Update order payment status
 * - Create refund accounting entries
 * - Restore stock via RETURN inventory transactions
 */
async function handleCaptureRefunded(event: any, webhookRecordId: string) {
  const capture = event.resource;
  const paypalOrderId = capture.supplementary_data?.related_ids?.order_id || capture.id;
  const refundAmount = parseFloat(capture.amount?.value || '0');

  console.log(`PayPal capture refunded: ${paypalOrderId}, refund amount: ${refundAmount}`);

  // Find the order
  const order = await prisma.order.findFirst({
    where: { paypalOrderId },
    include: { items: true },
  });

  if (!order) {
    console.warn(`Order not found for PayPal refund ${paypalOrderId}, skipping`);
    return;
  }

  // Determine if full or partial refund
  const orderTotal = Number(order.total);
  const isFullRefund = refundAmount >= orderTotal;

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
    // Calculate proportional tax refund
    const refundRatio = refundAmount / orderTotal;
    const refundTps = Math.round(Number(order.taxTps) * refundRatio * 100) / 100;
    const refundTvq = Math.round(Number(order.taxTvq) * refundRatio * 100) / 100;
    const refundTvh = Math.round(Number(order.taxTvh) * refundRatio * 100) / 100;

    await createRefundAccountingEntries(
      order.id,
      refundAmount,
      refundTps,
      refundTvq,
      refundTvh,
      'PayPal refund'
    );
    console.log(`Refund accounting entries created for order ${order.orderNumber}`);
  } catch (accError) {
    console.error(`Failed to create refund accounting entries for order ${order.id}:`, accError);
  }

  // Restore stock for full refunds
  if (isFullRefund) {
    try {
      for (const item of order.items) {
        if (item.formatId) {
          await prisma.productFormat.update({
            where: { id: item.formatId },
            data: { stockQuantity: { increment: item.quantity } },
          });
        }

        // Get current WAC
        const lastTransaction = await prisma.inventoryTransaction.findFirst({
          where: {
            productId: item.productId,
            formatId: item.formatId,
          },
          orderBy: { createdAt: 'desc' },
          select: { runningWAC: true },
        });
        const wac = lastTransaction ? Number(lastTransaction.runningWAC) : 0;

        // Create RETURN inventory transaction
        await prisma.inventoryTransaction.create({
          data: {
            productId: item.productId,
            formatId: item.formatId,
            type: 'RETURN',
            quantity: item.quantity,
            unitCost: wac,
            runningWAC: wac,
            orderId: order.id,
            reason: 'PayPal refund - stock restored',
          },
        });
      }
      console.log(`Stock restored for refunded order ${order.orderNumber}`);
    } catch (invError) {
      console.error(`Failed to restore stock for order ${order.id}:`, invError);
    }
  }
}

/**
 * Handle PAYMENT.CAPTURE.DENIED
 * - Update order status to failed
 */
async function handleCaptureDenied(event: any, webhookRecordId: string) {
  const capture = event.resource;
  const paypalOrderId = capture.supplementary_data?.related_ids?.order_id || capture.id;

  console.log(`PayPal capture denied: ${paypalOrderId}`);

  const order = await prisma.order.findFirst({
    where: { paypalOrderId },
  });

  if (!order) {
    console.warn(`Order not found for PayPal denied capture ${paypalOrderId}, skipping`);
    return;
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

  console.log(`Order ${order.orderNumber} marked as failed (PayPal capture denied)`);
}

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db as prisma } from '@/lib/db';
import { sendOrderLifecycleEmail } from '@/lib/email';
import { sendOrderNotificationSms, sendPaymentFailureAlertSms } from '@/lib/sms';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhooks for order status updates
 * TODO: Add accounting entries when accounting models are created in Prisma
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
    }

    console.log(`Stripe webhook received: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await handleRefund(event.data.object as Stripe.Charge);
        break;

      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment succeeded:', paymentIntent.id);

  const orderId = paymentIntent.metadata?.orderId;

  if (orderId) {
    try {
      const order = await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
          stripePaymentId: paymentIntent.id,
        },
      });
      console.log(`Order ${orderId} marked as paid`);

      // Create ambassador commission if the order used a referral code
      await createAmbassadorCommission(order.id, order.orderNumber, Number(order.total), order.promoCode);

      // Send order confirmation email (fire-and-forget)
      sendOrderLifecycleEmail(orderId, 'CONFIRMED').catch((err) => {
        console.error(`Failed to send confirmation email for order ${orderId}:`, err);
      });

      // Send SMS notification to admin (fire-and-forget)
      sendOrderNotificationSms(Number(order.total), order.orderNumber).catch((err) => {
        console.error(`Failed to send SMS for order ${orderId}:`, err);
      });
    } catch (error) {
      console.error('Error updating order:', error);
    }
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment failed:', paymentIntent.id);

  const orderId = paymentIntent.metadata?.orderId;
  const errorMessage = paymentIntent.last_payment_error?.message || 'Unknown error';
  const errorCode = paymentIntent.last_payment_error?.code || 'unknown';
  const customerEmail = paymentIntent.receipt_email || paymentIntent.metadata?.customerEmail;
  const amount = paymentIntent.amount / 100;

  // Log payment error to database
  try {
    await prisma.paymentError.create({
      data: {
        orderId: orderId || null,
        stripePaymentId: paymentIntent.id,
        errorType: errorCode,
        errorMessage: errorMessage,
        amount: amount,
        currency: paymentIntent.currency?.toUpperCase() || 'CAD',
        customerEmail: customerEmail || null,
        metadata: JSON.stringify({
          paymentMethodType: paymentIntent.payment_method_types,
          declineCode: paymentIntent.last_payment_error?.decline_code,
        }),
      },
    });
  } catch (logError) {
    // Table may not exist yet, log to console
    console.error('Failed to log payment error to DB (table may not exist):', logError);
  }

  // Send SMS alert for failed payment (fire-and-forget)
  sendPaymentFailureAlertSms(errorCode, amount, customerEmail || undefined).catch((err) => {
    console.error('Failed to send payment failure SMS:', err);
  });

  if (orderId) {
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'FAILED',
          status: 'CANCELLED',
        },
      });
      console.log(`Order ${orderId} marked as failed`);
    } catch (error) {
      console.error('Error updating order:', error);
    }
  }
}

/**
 * Handle refund
 */
async function handleRefund(charge: Stripe.Charge) {
  console.log('Charge refunded:', charge.id);

  const orderId = charge.metadata?.orderId;

  if (orderId) {
    try {
      const order = await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'REFUNDED',
          status: 'CANCELLED',
        },
      });
      console.log(`Order ${orderId} marked as refunded`);

      // Determine refund amount from Stripe charge data
      const refundAmount = charge.amount_refunded
        ? charge.amount_refunded / 100  // Stripe amounts are in cents
        : Number(order.total);
      const isPartial = charge.amount_refunded < charge.amount;

      // Send refund email (fire-and-forget)
      sendOrderLifecycleEmail(orderId, 'REFUNDED', {
        refundAmount,
        refundIsPartial: isPartial,
      }).catch((err) => {
        console.error(`Failed to send refund email for order ${orderId}:`, err);
      });
    } catch (error) {
      console.error('Error updating order:', error);
    }
  }
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('Checkout completed:', session.id);

  const orderId = session.metadata?.orderId;

  if (orderId) {
    try {
      const order = await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
          stripePaymentId: session.payment_intent as string,
        },
      });
      console.log(`Order ${orderId} confirmed from checkout session`);

      // Create ambassador commission if the order used a referral code
      await createAmbassadorCommission(order.id, order.orderNumber, Number(order.total), order.promoCode);

      // Send order confirmation email (fire-and-forget)
      sendOrderLifecycleEmail(orderId, 'CONFIRMED').catch((err) => {
        console.error(`Failed to send confirmation email for order ${orderId}:`, err);
      });

      // Send SMS notification to admin (fire-and-forget)
      sendOrderNotificationSms(Number(order.total), order.orderNumber).catch((err) => {
        console.error(`Failed to send SMS for checkout ${orderId}:`, err);
      });
    } catch (error) {
      console.error('Error updating order:', error);
    }
  }
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

  try {
    // Look up ambassador by referral code
    const ambassador = await prisma.ambassador.findUnique({
      where: { referralCode: promoCode },
    });

    if (!ambassador || ambassador.status !== 'ACTIVE') return;

    const rate = Number(ambassador.commissionRate);
    const commissionAmount = Math.round(orderTotal * rate) / 100;

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

    console.log(`Ambassador commission created: ${commissionAmount}$ for ${ambassador.name} (order ${orderNumber})`);
  } catch (error) {
    // Non-fatal: log but don't fail the webhook
    console.error('Error creating ambassador commission:', error);
  }
}

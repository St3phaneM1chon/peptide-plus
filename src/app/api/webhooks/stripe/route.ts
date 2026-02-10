import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db as prisma } from '@/lib/db';

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
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
          stripePaymentId: paymentIntent.id,
        },
      });
      console.log(`Order ${orderId} marked as paid`);
    } catch (error) {
      console.error('Error updating order:', error);
    }
  }

  // TODO: Generate accounting entry when models exist
  // await generateSaleEntry(paymentIntent);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment failed:', paymentIntent.id);

  const orderId = paymentIntent.metadata?.orderId;

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
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'REFUNDED',
          status: 'CANCELLED',
        },
      });
      console.log(`Order ${orderId} marked as refunded`);
    } catch (error) {
      console.error('Error updating order:', error);
    }
  }

  // TODO: Generate refund entry when models exist
  // await generateRefundEntry(charge);
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('Checkout completed:', session.id);

  const orderId = session.metadata?.orderId;

  if (orderId) {
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
          stripePaymentId: session.payment_intent as string,
        },
      });
      console.log(`Order ${orderId} confirmed from checkout session`);
    } catch (error) {
      console.error('Error updating order:', error);
    }
  }
}

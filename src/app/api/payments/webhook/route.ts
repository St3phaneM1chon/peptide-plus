export const dynamic = 'force-dynamic';
/**
 * API - Webhook Stripe
 * Gère les événements de paiement
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import {
  constructWebhookEvent,
  handlePaymentSucceeded,
  handlePaymentFailed,
  getReceiptUrl,
} from '@/lib/stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headersList = headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(body, signature);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Log l'événement
  console.log(`Stripe webhook received: ${event.type}`);

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Mettre à jour l'achat
        const purchase = await prisma.purchase.findFirst({
          where: { stripePaymentId: paymentIntent.id },
        });

        if (purchase) {
          // Récupérer l'URL du reçu
          const receiptUrl = await getReceiptUrl(paymentIntent.id);

          await prisma.purchase.update({
            where: { id: purchase.id },
            data: {
              status: 'COMPLETED',
              receiptUrl,
            },
          });

          // Créer l'accès au cours
          await prisma.courseAccess.create({
            data: {
              userId: purchase.userId,
              productId: purchase.productId,
              purchaseId: purchase.id,
            },
          });

          // Incrémenter le compteur d'achats
          await prisma.product.update({
            where: { id: purchase.productId },
            data: { purchaseCount: { increment: 1 } },
          });

          // Log d'audit
          await prisma.auditLog.create({
            data: {
              userId: purchase.userId,
              action: 'PAYMENT_SUCCEEDED',
              entityType: 'Purchase',
              entityId: purchase.id,
              details: JSON.stringify({
                paymentIntentId: paymentIntent.id,
                amount: paymentIntent.amount,
              }),
            },
          });

          // TODO: Envoyer email de confirmation
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        await prisma.purchase.updateMany({
          where: { stripePaymentId: paymentIntent.id },
          data: { status: 'FAILED' },
        });

        const purchase = await prisma.purchase.findFirst({
          where: { stripePaymentId: paymentIntent.id },
        });

        if (purchase) {
          await prisma.auditLog.create({
            data: {
              userId: purchase.userId,
              action: 'PAYMENT_FAILED',
              entityType: 'Purchase',
              entityId: purchase.id,
              details: JSON.stringify({
                paymentIntentId: paymentIntent.id,
                error: paymentIntent.last_payment_error?.message,
              }),
            },
          });
        }
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        
        await prisma.purchase.updateMany({
          where: { stripePaymentId: charge.payment_intent as string },
          data: { status: 'REFUNDED' },
        });
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        // Gérer les abonnements si nécessaire
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

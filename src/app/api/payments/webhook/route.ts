/**
 * Webhook Stripe - Traitement des événements de paiement
 * Avec envoi automatique d'emails de confirmation
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { sendEmail, orderConfirmationEmail, type OrderData } from '@/lib/email';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature')!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    // Traiter les différents événements
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSuccess(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailure(paymentIntent);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  console.log('Checkout session completed:', session.id);
  
  const { userId, shippingAddress } = session.metadata || {};
  const shipping = shippingAddress ? JSON.parse(shippingAddress) : null;

  // Générer le numéro de commande
  const orderNumber = `PP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  // Chercher ou créer la devise
  let currency = await prisma.currency.findUnique({
    where: { code: session.currency?.toUpperCase() || 'CAD' }
  });

  if (!currency) {
    currency = await prisma.currency.create({
      data: {
        code: session.currency?.toUpperCase() || 'CAD',
        name: session.currency?.toUpperCase() === 'USD' ? 'US Dollar' : 'Dollar canadien',
        symbol: '$',
        exchangeRate: 1,
      }
    });
  }

  // Créer la commande dans la base de données
  const order = await prisma.order.create({
    data: {
      orderNumber,
      userId: userId !== 'guest' ? userId : 'guest',
      subtotal: (session.amount_subtotal || 0) / 100,
      total: (session.amount_total || 0) / 100,
      currencyId: currency.id,
      paymentStatus: 'PAID',
      status: 'CONFIRMED',
      stripePaymentId: session.payment_intent as string,
      shippingName: shipping ? `${shipping.firstName} ${shipping.lastName}` : '',
      shippingAddress1: shipping?.address || '',
      shippingAddress2: shipping?.apartment || null,
      shippingCity: shipping?.city || '',
      shippingState: shipping?.province || '',
      shippingPostal: shipping?.postalCode || '',
      shippingCountry: shipping?.country || 'CA',
      shippingPhone: shipping?.phone || null,
    },
  });

  console.log('Order created:', order.id, 'Number:', orderNumber);

  // Envoyer email de confirmation automatiquement
  await sendOrderConfirmationEmailAsync(order.id, userId);
}

/**
 * Envoie l'email de confirmation de commande de manière asynchrone
 */
async function sendOrderConfirmationEmailAsync(orderId: string, userId: string) {
  try {
    // Récupérer la commande complète avec les items
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        currency: true,
      },
    });

    if (!order) {
      console.error('Order not found for confirmation email:', orderId);
      return;
    }

    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, locale: true },
    });

    if (!user) {
      console.error('User not found for confirmation email:', userId);
      return;
    }

    // Préparer les données pour le template
    const orderData: OrderData = {
      orderNumber: order.orderNumber,
      customerName: user.name || 'Client',
      customerEmail: user.email,
      items: order.items.map(item => ({
        name: item.productName,
        quantity: item.quantity,
        price: Number(item.unitPrice),
        sku: item.sku || undefined,
      })),
      subtotal: Number(order.subtotal),
      shipping: Number(order.shippingCost),
      tax: Number(order.tax),
      discount: order.discount ? Number(order.discount) : undefined,
      total: Number(order.total),
      currency: order.currency?.code || 'CAD',
      shippingAddress: {
        name: order.shippingName,
        address1: order.shippingAddress1,
        address2: order.shippingAddress2 || undefined,
        city: order.shippingCity,
        state: order.shippingState,
        postalCode: order.shippingPostal,
        country: order.shippingCountry,
      },
      locale: (user.locale as 'fr' | 'en') || 'fr',
    };

    // Générer et envoyer l'email
    const emailContent = orderConfirmationEmail(orderData);
    
    const result = await sendEmail({
      to: { email: user.email, name: user.name || undefined },
      subject: emailContent.subject,
      html: emailContent.html,
      tags: ['order', 'confirmation', order.orderNumber],
    });

    if (result.success) {
      console.log(`✅ Confirmation email sent for order ${order.orderNumber} to ${user.email}`);
    } else {
      console.error(`❌ Failed to send confirmation email: ${result.error}`);
    }
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    // Ne pas throw - l'erreur d'email ne doit pas affecter le traitement du paiement
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment succeeded:', paymentIntent.id);

  // Mettre à jour le statut de la commande
  await prisma.order.updateMany({
    where: { stripePaymentId: paymentIntent.id },
    data: { status: 'PAID' },
  });
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment failed:', paymentIntent.id);

  // Mettre à jour le statut de la commande
  await prisma.order.updateMany({
    where: { stripePaymentId: paymentIntent.id },
    data: { status: 'FAILED' },
  });

  // Envoyer notification d'échec (à implémenter)
  // await sendPaymentFailureNotification(paymentIntent);
}

/**
 * STRIPE - Gestion des Paiements
 * Carte, Apple Pay, Google Pay, Visa/MC Click to Pay
 */

import Stripe from 'stripe';
import { PaymentMethod } from '@/types';

// Client Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
});

// =====================================================
// CUSTOMERS
// =====================================================

/**
 * Crée un customer Stripe
 */
export async function createStripeCustomer(
  email: string,
  name?: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  return stripe.customers.create({
    email,
    name,
    metadata: {
      ...metadata,
      source: 'web-app',
    },
  });
}

/**
 * Récupère ou crée un customer Stripe
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<string> {
  const { prisma } = await import('./db');
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  
  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }
  
  const customer = await createStripeCustomer(email, name, { userId });
  
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });
  
  return customer.id;
}

// =====================================================
// PAYMENT INTENTS
// =====================================================

interface CreatePaymentIntentParams {
  amount: number; // En centimes
  currency?: string;
  customerId: string;
  productId: string;
  metadata?: Record<string, string>;
  paymentMethodTypes?: string[];
}

/**
 * Crée un Payment Intent
 */
export async function createPaymentIntent({
  amount,
  currency = 'cad',
  customerId,
  productId,
  metadata = {},
  paymentMethodTypes = ['card', 'link'], // link = Click to Pay
}: CreatePaymentIntentParams): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create({
    amount,
    currency,
    customer: customerId,
    payment_method_types: paymentMethodTypes,
    metadata: {
      productId,
      ...metadata,
    },
    // Options pour Apple Pay / Google Pay
    automatic_payment_methods: {
      enabled: true,
      allow_redirects: 'never',
    },
  });
}

/**
 * Récupère un Payment Intent
 */
export async function getPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Confirme un Payment Intent
 */
export async function confirmPaymentIntent(
  paymentIntentId: string,
  paymentMethodId: string
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: paymentMethodId,
  });
}

// =====================================================
// PAYMENT METHODS (CARTES SAUVEGARDÉES)
// =====================================================

/**
 * Attache une méthode de paiement à un customer
 */
export async function attachPaymentMethod(
  paymentMethodId: string,
  customerId: string
): Promise<Stripe.PaymentMethod> {
  return stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  });
}

/**
 * Liste les méthodes de paiement d'un customer
 */
export async function listPaymentMethods(
  customerId: string
): Promise<Stripe.PaymentMethod[]> {
  const response = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
  });
  return response.data;
}

/**
 * Définit la méthode de paiement par défaut
 */
export async function setDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<Stripe.Customer> {
  return stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });
}

/**
 * Supprime une méthode de paiement
 */
export async function detachPaymentMethod(
  paymentMethodId: string
): Promise<Stripe.PaymentMethod> {
  return stripe.paymentMethods.detach(paymentMethodId);
}

// =====================================================
// CHECKOUT SESSIONS
// =====================================================

interface CreateCheckoutSessionParams {
  customerId: string;
  priceAmount: number;
  productName: string;
  productId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

/**
 * Crée une session Checkout Stripe
 */
export async function createCheckoutSession({
  customerId,
  priceAmount,
  productName,
  productId,
  successUrl,
  cancelUrl,
  metadata = {},
}: CreateCheckoutSessionParams): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: 'cad',
          unit_amount: priceAmount,
          product_data: {
            name: productName,
            metadata: { productId },
          },
        },
        quantity: 1,
      },
    ],
    payment_method_types: [
      'card',
      'link', // Click to Pay
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      productId,
      ...metadata,
    },
    // Permettre de sauvegarder la carte
    payment_intent_data: {
      setup_future_usage: 'on_session',
    },
  });
}

// =====================================================
// WEBHOOKS
// =====================================================

/**
 * Vérifie la signature d'un webhook Stripe
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  );
}

/**
 * Traite un événement de paiement réussi
 */
export async function handlePaymentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const { prisma } = await import('./db');
  
  const productId = paymentIntent.metadata.productId;
  const userId = paymentIntent.metadata.userId;
  
  if (!productId || !userId) {
    console.error('Missing metadata in payment intent');
    return;
  }
  
  // Mettre à jour l'achat
  await prisma.purchase.updateMany({
    where: {
      stripePaymentId: paymentIntent.id,
    },
    data: {
      status: 'COMPLETED',
    },
  });
  
  // Créer l'accès au cours
  const purchase = await prisma.purchase.findFirst({
    where: { stripePaymentId: paymentIntent.id },
  });
  
  if (purchase) {
    await prisma.courseAccess.create({
      data: {
        userId: purchase.userId,
        productId: purchase.productId,
        purchaseId: purchase.id,
      },
    });
    
    // Incrémenter le compteur d'achats du produit
    await prisma.product.update({
      where: { id: productId },
      data: {
        purchaseCount: { increment: 1 },
      },
    });
  }
}

/**
 * Traite un échec de paiement
 */
export async function handlePaymentFailed(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const { prisma } = await import('./db');
  
  await prisma.purchase.updateMany({
    where: {
      stripePaymentId: paymentIntent.id,
    },
    data: {
      status: 'FAILED',
    },
  });
}

// =====================================================
// INVOICES / RECEIPTS
// =====================================================

/**
 * Crée une facture pour un achat
 */
export async function createInvoice(
  customerId: string,
  amount: number,
  description: string
): Promise<Stripe.Invoice> {
  // Créer un invoice item
  await stripe.invoiceItems.create({
    customer: customerId,
    amount,
    currency: 'cad',
    description,
  });
  
  // Créer et finaliser la facture
  const invoice = await stripe.invoices.create({
    customer: customerId,
    auto_advance: true,
  });
  
  return stripe.invoices.finalizeInvoice(invoice.id);
}

/**
 * Récupère l'URL du reçu
 */
export async function getReceiptUrl(
  paymentIntentId: string
): Promise<string | null> {
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge'],
  });
  
  const charge = paymentIntent.latest_charge as Stripe.Charge;
  return charge?.receipt_url || null;
}

// =====================================================
// HELPERS
// =====================================================

/**
 * Convertit le type de paiement Stripe en PaymentMethod
 */
export function stripePaymentMethodToEnum(
  stripeMethod: Stripe.PaymentMethod
): PaymentMethod {
  if (stripeMethod.type === 'card') {
    if (stripeMethod.card?.wallet?.type === 'apple_pay') {
      return PaymentMethod.APPLE_PAY;
    }
    if (stripeMethod.card?.wallet?.type === 'google_pay') {
      return PaymentMethod.GOOGLE_PAY;
    }
    return PaymentMethod.STRIPE_CARD;
  }
  
  if (stripeMethod.type === 'link') {
    // Link peut être Visa ou Mastercard Click to Pay
    return PaymentMethod.VISA_CLICK_TO_PAY; // Simplified
  }
  
  return PaymentMethod.STRIPE_CARD;
}

export { stripe };

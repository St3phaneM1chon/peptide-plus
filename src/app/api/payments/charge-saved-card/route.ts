export const dynamic = 'force-dynamic';
/**
 * API - Charge a Saved Card
 * Creates and confirms a Stripe PaymentIntent using a previously saved
 * payment method (stored in the SavedCard model).
 *
 * Flow:
 * 1. Validate the saved card belongs to the authenticated user
 * 2. Get or create Stripe customer
 * 3. Create a PaymentIntent with the saved payment method
 * 4. Confirm the PaymentIntent immediately (off-session style, on-session context)
 * 5. Return success/failure to the frontend
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Stripe from 'stripe';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { getOrCreateStripeCustomer } from '@/lib/stripe';
import { calculateTaxAmount } from '@/lib/tax-rates';
import { STRIPE_API_VERSION } from '@/lib/stripe';
import { validateCsrf } from '@/lib/csrf-middleware';

const chargeSavedCardSchema = z.object({
  cardId: z.string().min(1, 'Card ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
  province: z.string().length(2).optional(),
  companyId: z.string().optional(),
});

// Lazy-initialized Stripe client (same pattern as src/lib/stripe.ts)
let _stripe: Stripe | null = null;
function getStripeClient(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    });
  }
  return _stripe;
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: CSRF protection for payment mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const result = chargeSavedCardSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation error', details: result.error.issues },
        { status: 400 }
      );
    }

    const { cardId, productId, province: reqProvince, companyId } = result.data;

    // Idempotency key to prevent duplicate payments
    const idempotencyKey = request.headers.get('x-idempotency-key');
    if (idempotencyKey) {
      const existingPurchase = await prisma.purchase.findFirst({
        where: { idempotencyKey },
      });
      if (existingPurchase) {
        return NextResponse.json({
          success: existingPurchase.status === 'COMPLETED',
          paymentIntentId: existingPurchase.stripePaymentId,
          amount: Number(existingPurchase.amount),
          message: 'Duplicate request - existing payment returned',
        });
      }
    }

    // Verify the saved card belongs to this user
    const savedCard = await prisma.savedCard.findFirst({
      where: {
        id: cardId,
        userId: session.user.id,
      },
    });

    if (!savedCard) {
      return NextResponse.json(
        { error: 'Saved card not found or does not belong to you' },
        { status: 404 }
      );
    }

    // Fetch the product
    const product = await prisma.product.findUnique({
      where: { id: productId, isActive: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Validate stock
    if (product.trackInventory && Number(product.stockQuantity ?? 0) <= 0) {
      return NextResponse.json({ error: 'Out of stock' }, { status: 400 });
    }

    // Calculate taxes
    const subtotal = Number(product.price);
    const province = (reqProvince || 'QC').toUpperCase();
    const taxAmount = calculateTaxAmount(subtotal, province);
    const total = Math.round((subtotal + taxAmount) * 100); // In cents

    // Get or create Stripe customer
    const stripeCustomerId = await getOrCreateStripeCustomer(
      session.user.id,
      session.user.email,
      session.user.name
    );

    const stripe = getStripeClient();

    // Create and confirm PaymentIntent in one call using the saved payment method
    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: 'cad',
      customer: stripeCustomerId,
      payment_method: savedCard.stripePaymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      metadata: {
        userId: session.user.id,
        productId,
        companyId: companyId || '',
        savedCardId: cardId,
      },
    });

    const isSucceeded = paymentIntent.status === 'succeeded';

    // Create purchase record
    await prisma.purchase.create({
      data: {
        userId: session.user.id,
        productId,
        companyId: companyId || null,
        amount: total / 100,
        currency: 'CAD',
        paymentMethod: 'STRIPE_CARD',
        stripePaymentId: paymentIntent.id,
        status: isSucceeded ? 'COMPLETED' : 'PENDING',
        receiptNumber: `REC-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        idempotencyKey: idempotencyKey || undefined,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: isSucceeded ? 'SAVED_CARD_PAYMENT_SUCCEEDED' : 'SAVED_CARD_PAYMENT_PENDING',
        entityType: 'Purchase',
        entityId: paymentIntent.id,
        details: JSON.stringify({
          productId,
          amount: total,
          savedCardId: cardId,
          cardBrand: savedCard.brand,
          cardLast4: savedCard.last4,
          status: paymentIntent.status,
        }),
      },
    });

    if (isSucceeded) {
      return NextResponse.json({
        success: true,
        paymentIntentId: paymentIntent.id,
        amount: total,
      });
    }

    // Payment requires additional action (e.g. 3D Secure)
    if (paymentIntent.status === 'requires_action') {
      return NextResponse.json({
        success: false,
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
        error: 'Additional authentication required',
      });
    }

    // Other non-success statuses
    return NextResponse.json({
      success: false,
      error: `Payment status: ${paymentIntent.status}`,
    });
  } catch (error) {
    logger.error('Error charging saved card', { error: error instanceof Error ? error.message : String(error) });

    // Handle Stripe-specific errors with user-friendly messages
    if (error instanceof Stripe.errors.StripeCardError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error processing payment with saved card' },
      { status: 500 }
    );
  }
}

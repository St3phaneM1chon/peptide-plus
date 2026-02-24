export const dynamic = 'force-dynamic';
/**
 * API - Express Checkout (Apple Pay / Google Pay)
 * Creates a Stripe PaymentIntent with automatic_payment_methods enabled,
 * which supports Apple Pay and Google Pay via the Payment Request API.
 *
 * The frontend uses the returned clientSecret with the Stripe Payment
 * Request Button element to complete the express checkout flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { createPaymentIntent, getOrCreateStripeCustomer } from '@/lib/stripe';
import { calculateTaxAmount } from '@/lib/tax-rates';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { add, toCents } from '@/lib/decimal-calculator';
import { logger } from '@/lib/logger';

const expressCheckoutSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  type: z.enum(['apple-pay', 'google-pay'], {
    required_error: 'Payment type must be apple-pay or google-pay',
  }),
  province: z.string().length(2).optional(),
  companyId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limiting on express checkout
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/payments/express');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

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

    const result = expressCheckoutSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation error', details: result.error.issues },
        { status: 400 }
      );
    }

    const { productId, type, province: reqProvince, companyId } = result.data;

    // Idempotency key to prevent duplicate payments
    const idempotencyKey = request.headers.get('x-idempotency-key');
    if (idempotencyKey) {
      const existingPurchase = await prisma.purchase.findFirst({
        where: { idempotencyKey },
      });
      if (existingPurchase) {
        return NextResponse.json({
          clientSecret: null,
          paymentIntentId: existingPurchase.stripePaymentId,
          amount: Number(existingPurchase.amount),
          message: 'Duplicate request - existing payment returned',
        });
      }
    }

    // Fetch the product
    const product = await prisma.product.findUnique({
      where: { id: productId, isActive: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // NOTE: stockQuantity is on ProductFormat, not Product.
    // Full stock validation should check formats. Basic check: product must be active.
    if (!product.isActive) {
      return NextResponse.json({ error: 'Product is not available' }, { status: 400 });
    }

    // Calculate taxes
    const subtotal = Number(product.price);
    const province = (reqProvince || 'QC').toUpperCase();
    const taxAmount = calculateTaxAmount(subtotal, province);
    const total = toCents(add(subtotal, taxAmount));

    // Get or create Stripe customer
    const stripeCustomerId = await getOrCreateStripeCustomer(
      session.user.id,
      session.user.email,
      session.user.name
    );

    // Map frontend type to Stripe-compatible payment method type
    const paymentMethodType = type === 'apple-pay' ? 'APPLE_PAY' : 'GOOGLE_PAY';

    // Create Payment Intent with automatic_payment_methods for Apple Pay / Google Pay
    const paymentIntent = await createPaymentIntent({
      amount: total,
      currency: 'cad',
      customerId: stripeCustomerId,
      productId,
      metadata: {
        userId: session.user.id,
        productId,
        companyId: companyId || '',
        expressCheckoutType: type,
      },
    });

    // Create pending purchase record
    await prisma.purchase.create({
      data: {
        userId: session.user.id,
        productId,
        companyId: companyId || null,
        amount: total / 100,
        currency: 'CAD',
        paymentMethod: paymentMethodType,
        stripePaymentId: paymentIntent.id,
        status: 'PENDING',
        receiptNumber: `REC-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        idempotencyKey: idempotencyKey || undefined,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'EXPRESS_CHECKOUT_INTENT_CREATED',
        entityType: 'Purchase',
        entityId: paymentIntent.id,
        details: JSON.stringify({
          productId,
          amount: total,
          type,
        }),
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: total,
    });
  } catch (error) {
    logger.error('Error creating express checkout intent', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error creating express checkout payment' },
      { status: 500 }
    );
  }
}

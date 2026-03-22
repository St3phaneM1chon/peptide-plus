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
import { getClientIpFromRequest } from '@/lib/admin-audit';

const expressCheckoutSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  optionId: z.string().optional(), // COMMERCE-006: Accept optionId for stock validation
  quantity: z.number().int().min(1).max(100).optional().default(1),
  type: z.enum(['apple-pay', 'google-pay'], {
    required_error: 'Payment type must be apple-pay or google-pay',
  }),
  province: z.string().length(2).optional(),
  companyId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limiting on express checkout
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/payments/express');
    if (!rl.success) {
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
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
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { productId, optionId, quantity, type, province: reqProvince, companyId } = result.data;

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

    if (!product.isActive) {
      return NextResponse.json({ error: 'Product is not available' }, { status: 400 });
    }

    // COMMERCE-006 FIX: Validate stock at format level before creating express checkout
    let unitPrice = Number(product.price);
    if (optionId) {
      const format = await prisma.productOption.findUnique({
        where: { id: optionId },
        select: { price: true, productId: true, stockQuantity: true, trackInventory: true },
      });
      if (!format) {
        return NextResponse.json({ error: 'Format not found' }, { status: 404 });
      }
      if (format.productId !== productId) {
        return NextResponse.json({ error: 'Format does not belong to product' }, { status: 400 });
      }
      if (format.trackInventory && format.stockQuantity < quantity) {
        return NextResponse.json({
          error: `Insufficient stock. Available: ${format.stockQuantity}`,
        }, { status: 400 });
      }
      unitPrice = Number(format.price);
    }

    // Calculate taxes
    const subtotal = unitPrice * quantity;
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

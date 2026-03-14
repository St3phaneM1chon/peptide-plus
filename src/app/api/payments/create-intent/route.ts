export const dynamic = 'force-dynamic';
/**
 * API - Créer un Payment Intent Stripe
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

const createIntentSchema = z.object({
  productId: z.string().min(1, 'Product ID requis'),
  formatId: z.string().optional(), // COMMERCE-005: Accept formatId for stock validation
  quantity: z.number().int().min(1).max(100).optional().default(1),
  saveCard: z.boolean().optional(),
  companyId: z.string().optional(),
  province: z.string().max(2).optional(),
  country: z.string().max(2).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limiting on payment intent creation
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/payments/create-intent');
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
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // BE-PAY-05: Idempotency key to prevent duplicate payments
    const idempotencyKey = request.headers.get('x-idempotency-key');
    if (idempotencyKey) {
      const existingPurchase = await prisma.purchase.findFirst({
        where: { idempotencyKey },
      });
      if (existingPurchase) {
        return NextResponse.json({
          paymentIntentId: existingPurchase.stripePaymentId,
          amount: Number(existingPurchase.amount),
          message: 'Duplicate request - existing payment returned',
        });
      }
    }

    const body = await request.json();
    const parsed = createIntentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { productId, formatId, quantity, saveCard, companyId, province: reqProvince, country: reqCountry } = parsed.data;

    // Récupérer le produit
    const product = await prisma.product.findUnique({
      where: { id: productId, isActive: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Produit non trouvé' }, { status: 404 });
    }

    if (!product.isActive) {
      return NextResponse.json({ error: 'Product is not available' }, { status: 400 });
    }

    // COMMERCE-005 FIX: Validate stock at format level before creating payment intent
    let unitPrice = Number(product.price);
    if (formatId) {
      const format = await prisma.productFormat.findUnique({
        where: { id: formatId },
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

    // BE-PAY-11: Calculate taxes based on province and country
    // International orders (country !== CA) → 0% tax (handled by customs)
    // Canadian orders → province-specific rates (default QC if not specified)
    const subtotal = unitPrice * quantity;
    const province = (reqProvince || 'QC').toUpperCase();
    const country = (reqCountry || 'CA').toUpperCase();
    const taxAmount = calculateTaxAmount(subtotal, province, country);
    const total = toCents(add(subtotal, taxAmount));

    // Récupérer ou créer le customer Stripe
    const stripeCustomerId = await getOrCreateStripeCustomer(
      session.user.id,
      session.user.email,
      session.user.name
    );

    // Créer le Payment Intent
    const paymentIntent = await createPaymentIntent({
      amount: total,
      currency: 'cad',
      customerId: stripeCustomerId,
      productId,
      metadata: {
        userId: session.user.id,
        productId,
        companyId: companyId || '',
        saveCard: saveCard ? 'true' : 'false',
      },
      paymentMethodTypes: saveCard
        ? ['card', 'link']
        : ['card', 'link'],
    });

    // Créer l'achat en statut pending
    await prisma.purchase.create({
      data: {
        userId: session.user.id,
        productId,
        companyId: companyId || null,
        amount: total / 100, // Store total (in dollars) to match what Stripe charges
        currency: 'CAD',
        paymentMethod: 'STRIPE_CARD',
        stripePaymentId: paymentIntent.id,
        status: 'PENDING',
        receiptNumber: `REC-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        idempotencyKey: idempotencyKey || undefined,
      },
    });

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'PAYMENT_INTENT_CREATED',
        entityType: 'Purchase',
        entityId: paymentIntent.id,
        details: JSON.stringify({
          productId,
          amount: total,
        }),
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: total,
    });
  } catch (error) {
    logger.error('Error creating payment intent', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la création du paiement' },
      { status: 500 }
    );
  }
}

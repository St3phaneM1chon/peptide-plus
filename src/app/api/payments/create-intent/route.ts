export const dynamic = 'force-dynamic';
/**
 * API - Créer un Payment Intent Stripe
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { createPaymentIntent, getOrCreateStripeCustomer } from '@/lib/stripe';
import { calculateTaxAmount } from '@/lib/tax-rates';
import { validateCsrf } from '@/lib/csrf-middleware';
import { add, toCents } from '@/lib/decimal-calculator';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
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

    const { productId, saveCard, companyId, province: reqProvince } = await request.json();

    if (!productId) {
      return NextResponse.json({ error: 'Product ID requis' }, { status: 400 });
    }

    // Récupérer le produit
    const product = await prisma.product.findUnique({
      where: { id: productId, isActive: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Produit non trouvé' }, { status: 404 });
    }

    // BUG 2: Validate stock before creating payment intent
    if (product.trackInventory && Number(product.stockQuantity ?? 0) <= 0) {
      return NextResponse.json({ error: 'Out of stock' }, { status: 400 });
    }

    // BE-PAY-11: Calculate taxes based on province (not hardcoded to QC)
    const subtotal = Number(product.price);
    const province = (reqProvince || 'QC').toUpperCase();
    const taxAmount = calculateTaxAmount(subtotal, province);
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

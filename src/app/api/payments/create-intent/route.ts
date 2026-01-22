export const dynamic = 'force-dynamic';
/**
 * API - Créer un Payment Intent Stripe
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { createPaymentIntent, getOrCreateStripeCustomer } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { productId, saveCard, companyId } = await request.json();

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

    // Calculer le montant total avec taxes
    const subtotal = Number(product.price);
    const tps = subtotal * 0.05;
    const tvq = subtotal * 0.09975;
    const total = Math.round((subtotal + tps + tvq) * 100); // En centimes

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
        amount: subtotal,
        currency: 'CAD',
        paymentMethod: 'STRIPE_CARD',
        stripePaymentId: paymentIntent.id,
        status: 'PENDING',
        receiptNumber: `REC-${Date.now()}`,
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
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du paiement' },
      { status: 500 }
    );
  }
}

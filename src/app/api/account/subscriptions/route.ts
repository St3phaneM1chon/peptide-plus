export const dynamic = 'force-dynamic';

/**
 * API Subscriptions client
 * GET  /api/account/subscriptions    — Lister mes abonnements
 * POST /api/account/subscriptions    — Créer un abonnement
 * PATCH /api/account/subscriptions   — Pause/Resume/Cancel
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { validateCsrf } from '@/lib/csrf-middleware';

const FREQUENCY_DISCOUNTS: Record<string, number> = {
  EVERY_2_MONTHS: 15,
  EVERY_4_MONTHS: 12,
  EVERY_6_MONTHS: 10,
  EVERY_12_MONTHS: 5,
};

const FREQUENCY_DAYS: Record<string, number> = {
  EVERY_2_MONTHS: 60,
  EVERY_4_MONTHS: 120,
  EVERY_6_MONTHS: 180,
  EVERY_12_MONTHS: 365,
};

async function getUser(session: { user?: { email?: string | null } }) {
  if (!session?.user?.email) return null;
  return db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
}

// GET — List subscriptions
export async function GET() {
  try {
    const session = await auth();
    const user = await getUser(session as { user?: { email?: string | null } });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptions = await db.subscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        productId: s.productId,
        formatId: s.formatId,
        productName: s.productName,
        formatName: s.formatName,
        quantity: s.quantity,
        frequency: s.frequency,
        discountPercent: s.discountPercent,
        unitPrice: Number(s.unitPrice),
        status: s.status,
        nextDelivery: s.nextDelivery.toISOString(),
        lastDelivery: s.lastDelivery?.toISOString() || null,
        createdAt: s.createdAt.toISOString(),
        cancelledAt: s.cancelledAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    logger.error('Error fetching subscriptions', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST — Create subscription
export async function POST(request: NextRequest) {
  try {
    // SECURITY (BE-SEC-15): CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();
    const user = await getUser(session as { user?: { email?: string | null } });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { productId, formatId, quantity, frequency } = body;

    if (!productId || !frequency) {
      return NextResponse.json({ error: 'productId and frequency are required' }, { status: 400 });
    }

    const freq = frequency.toUpperCase();
    if (!FREQUENCY_DISCOUNTS[freq]) {
      return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 });
    }

    // Fetch product info
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { name: true, price: true, isActive: true },
    });

    if (!product || !product.isActive) {
      return NextResponse.json({ error: 'Product not found or inactive' }, { status: 404 });
    }

    // Fetch format info if provided
    let formatName: string | null = null;
    let unitPrice = Number(product.price);

    if (formatId) {
      const format = await db.productFormat.findUnique({
        where: { id: formatId },
        select: { name: true, price: true, isActive: true },
      });

      if (!format || !format.isActive) {
        return NextResponse.json({ error: 'Format not found or inactive' }, { status: 404 });
      }

      formatName = format.name;
      unitPrice = Number(format.price);
    }

    // DI-63: Don't set nextDelivery until payment is confirmed and status becomes ACTIVE.
    // BE-PAY-07: Subscription starts as PENDING_PAYMENT until recurring billing
    // is confirmed via Stripe. The subscription should NOT grant product access
    // or trigger deliveries until status is changed to ACTIVE by the payment
    // confirmation webhook.
    //
    // TODO: Integrate with Stripe Subscriptions API:
    // 1. Create or retrieve a Stripe Customer for this user
    // 2. Create a Stripe Price for the product/format with the recurring interval
    // 3. Create a Stripe Subscription with the price
    // 4. Return Stripe's checkout URL for the customer to complete payment
    // 5. On webhook `invoice.paid` / `customer.subscription.created`, set status to ACTIVE
    //    and calculate nextDelivery based on FREQUENCY_DAYS[freq]
    // 6. On webhook `customer.subscription.deleted`, set status to CANCELLED
    // 7. On webhook `invoice.payment_failed`, set status to PAST_DUE
    //
    // Until Stripe recurring billing is integrated, subscriptions are created
    // as PENDING_PAYMENT to prevent unbilled product access.

    const subscription = await db.subscription.create({
      data: {
        userId: user.id,
        productId,
        formatId: formatId || null,
        productName: product.name,
        formatName,
        quantity: quantity || 1,
        frequency: freq,
        discountPercent: FREQUENCY_DISCOUNTS[freq],
        unitPrice,
        status: 'PENDING_PAYMENT', // BE-PAY-07: Not ACTIVE until billing confirmed
        nextDelivery: new Date('9999-12-31'), // DI-63: Placeholder; recalculate when status becomes ACTIVE
      },
    });

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        productId: subscription.productId,
        formatId: subscription.formatId,
        productName: subscription.productName,
        formatName: subscription.formatName,
        quantity: subscription.quantity,
        frequency: subscription.frequency,
        discountPercent: subscription.discountPercent,
        unitPrice: Number(subscription.unitPrice),
        status: subscription.status,
        // BE-PAY-07: Inform client that payment setup is required
        paymentRequired: true,
        message: 'Subscription created. Payment setup required before activation.',
        nextDelivery: subscription.nextDelivery.toISOString(),
        createdAt: subscription.createdAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error creating subscription', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH — Pause/Resume/Cancel
export async function PATCH(request: NextRequest) {
  try {
    // SECURITY (BE-SEC-15): CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();
    const user = await getUser(session as { user?: { email?: string | null } });
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({ error: 'id and action are required' }, { status: 400 });
    }

    // Verify ownership
    const subscription = await db.subscription.findFirst({
      where: { id, userId: user.id },
    });

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'pause':
        if (subscription.status !== 'ACTIVE') {
          return NextResponse.json({ error: 'Can only pause active subscriptions' }, { status: 400 });
        }
        updateData = { status: 'PAUSED' };
        break;
      case 'resume':
        if (subscription.status !== 'PAUSED') {
          return NextResponse.json({ error: 'Can only resume paused subscriptions' }, { status: 400 });
        }
        const daysUntilNext = FREQUENCY_DAYS[subscription.frequency] || 30;
        const nextDelivery = new Date();
        nextDelivery.setDate(nextDelivery.getDate() + daysUntilNext);
        updateData = { status: 'ACTIVE', nextDelivery };
        break;
      case 'cancel':
        if (subscription.status === 'CANCELLED') {
          return NextResponse.json({ error: 'Already cancelled' }, { status: 400 });
        }
        updateData = { status: 'CANCELLED', cancelledAt: new Date() };
        break;
      default:
        return NextResponse.json({ error: 'Invalid action. Use: pause, resume, cancel' }, { status: 400 });
    }

    const updated = await db.subscription.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      subscription: {
        id: updated.id,
        status: updated.status,
        nextDelivery: updated.nextDelivery.toISOString(),
        cancelledAt: updated.cancelledAt?.toISOString() || null,
      },
    });
  } catch (error) {
    logger.error('Error updating subscription', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

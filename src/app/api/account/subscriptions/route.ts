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

const FREQUENCY_DISCOUNTS: Record<string, number> = {
  WEEKLY: 20,
  BIWEEKLY: 15,
  MONTHLY: 10,
  BIMONTHLY: 5,
  QUARTERLY: 5,
};

const FREQUENCY_DAYS: Record<string, number> = {
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
  BIMONTHLY: 60,
  QUARTERLY: 90,
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
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST — Create subscription
export async function POST(request: NextRequest) {
  try {
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

    const daysUntilNext = FREQUENCY_DAYS[freq];
    const nextDelivery = new Date();
    nextDelivery.setDate(nextDelivery.getDate() + daysUntilNext);

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
        status: 'ACTIVE',
        nextDelivery,
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
        nextDelivery: subscription.nextDelivery.toISOString(),
        createdAt: subscription.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH — Pause/Resume/Cancel
export async function PATCH(request: NextRequest) {
  try {
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
    console.error('Error updating subscription:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

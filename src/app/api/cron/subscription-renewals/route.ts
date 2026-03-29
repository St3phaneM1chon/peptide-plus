export const dynamic = 'force-dynamic';

/**
 * CRON Job — Subscription Renewals
 * Processes subscriptions where nextDelivery <= now and status = ACTIVE.
 * Creates renewal orders and advances the next delivery date.
 *
 * Schedule: daily at 6:00 AM
 * GET /api/cron/subscription-renewals (Authorization: Bearer CRON_SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { dispatchModuleEvent } from '@/lib/events/cross-module-dispatcher';

const FREQUENCY_DAYS: Record<string, number> = {
  EVERY_2_MONTHS: 60,
  EVERY_4_MONTHS: 120,
  EVERY_6_MONTHS: 180,
  EVERY_12_MONTHS: 365,
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 401 });
  }

  const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  let secretsMatch = false;
  try {
    const a = Buffer.from(cronSecret, 'utf8');
    const b = Buffer.from(providedSecret, 'utf8');
    secretsMatch = a.length === b.length && timingSafeEqual(a, b);
  } catch { secretsMatch = false; }

  if (!secretsMatch) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = { processed: 0, created: 0, failed: 0, skipped: 0 };
  const now = new Date();

  try {
    // Find all active subscriptions due for renewal
    const dueSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        nextDelivery: { lte: now },
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
        product: { select: { id: true, name: true, price: true } },
        option: { select: { id: true, name: true, price: true, stockQuantity: true } },
      },
      take: 100, // Process max 100 per run to avoid timeout
    });

    logger.info(`[Subscription Renewal] Found ${dueSubscriptions.length} subscriptions due`, {
      count: dueSubscriptions.length,
    });

    for (const sub of dueSubscriptions) {
      results.processed++;

      try {
        if (!sub.user || !sub.product) {
          results.skipped++;
          logger.warn('[Subscription Renewal] Skipping: missing user or product', { subId: sub.id });
          continue;
        }

        // Check stock availability
        const stockQty = sub.option?.stockQuantity ?? sub.product?.price ? 999 : 0;
        if (stockQty < sub.quantity) {
          results.skipped++;
          logger.warn('[Subscription Renewal] Skipping: insufficient stock', {
            subId: sub.id,
            available: stockQty,
            needed: sub.quantity,
          });
          continue;
        }

        // Calculate renewal price with subscription discount
        const basePrice = Number(sub.option?.price ?? sub.product.price ?? sub.unitPrice);
        const discountedPrice = basePrice * (1 - sub.discountPercent / 100);
        const total = discountedPrice * sub.quantity;

        // Create renewal order
        const orderNumber = `SUB-${Date.now().toString(36).toUpperCase()}`;
        // Fetch the default currency for the tenant
        const defaultCurrency = await prisma.currency.findFirst({
          where: { code: 'CAD' },
          select: { id: true },
        });

        const order = await prisma.order.create({
          data: {
            tenantId: sub.tenantId,
            userId: sub.userId!,
            orderNumber,
            orderType: 'SUBSCRIPTION_RENEWAL',
            status: 'PENDING',
            paymentStatus: 'PENDING',
            subtotal: total,
            discount: basePrice * sub.quantity - total,
            tax: 0,
            taxTps: 0,
            taxTvq: 0,
            taxTvh: 0,
            taxPst: 0,
            shippingCost: 0,
            total,
            currencyId: defaultCurrency?.id || 'cad',
            exchangeRate: 1,
            paymentMethod: 'STRIPE_CARD',
            shippingName: sub.user.name || '',
            shippingAddress1: '',
            shippingCity: '',
            shippingPostal: '',
            shippingCountry: 'CA',
            shippingState: '',
            idempotencyKey: `sub-${sub.id}-${now.toISOString().slice(0, 10)}`,
            items: {
              create: [{
                tenantId: sub.tenantId,
                productId: sub.productId!,
                optionId: sub.optionId,
                productName: sub.productName,
                optionName: sub.optionName,
                quantity: sub.quantity,
                unitPrice: discountedPrice,
                discount: basePrice - discountedPrice,
                total: total,
              }],
            },
          },
        });

        // Advance next delivery date
        const frequencyDays = FREQUENCY_DAYS[sub.frequency] || 60;
        const nextDelivery = new Date(now);
        nextDelivery.setDate(nextDelivery.getDate() + frequencyDays);

        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            lastDelivery: now,
            nextDelivery,
            nextBillingDate: nextDelivery,
          },
        });

        // Dispatch cross-module event for accounting + workflows
        if (sub.tenantId) {
          await dispatchModuleEvent({
            type: 'ORDER_CREATED',
            tenantId: sub.tenantId,
            entityId: order.id,
            userId: sub.userId!,
            data: {
              amount: total,
              currency: 'CAD',
              description: `Renouvellement: ${sub.productName}`,
              subscriptionId: sub.id,
            },
          });
        }

        results.created++;
        logger.info('[Subscription Renewal] Order created', {
          subId: sub.id,
          orderId: order.id,
          orderNumber,
          total,
        });
      } catch (subError) {
        results.failed++;
        logger.error('[Subscription Renewal] Failed to process subscription', {
          subId: sub.id,
          error: subError instanceof Error ? subError.message : String(subError),
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    logger.error('[Subscription Renewal] Cron failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

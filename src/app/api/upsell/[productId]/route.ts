export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

const FREQUENCY_DISCOUNTS: Record<string, number> = {
  EVERY_2_MONTHS: 15,
  EVERY_4_MONTHS: 12,
  EVERY_6_MONTHS: 10,
  EVERY_12_MONTHS: 5,
};

// GET — Return upsell config for a product (public, no auth)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;

    // Try product-specific config first, then fallback to global (productId=null)
    let config = await db.upsellConfig.findUnique({
      where: { productId },
    });

    if (!config) {
      config = await db.upsellConfig.findFirst({
        where: { productId: null },
      });
    }

    // No config at all → upsell disabled
    if (!config || !config.isEnabled) {
      return NextResponse.json({ enabled: false });
    }

    // Fetch quantity discounts for the product
    const quantityDiscounts = config.showQuantityDiscount
      ? await db.quantityDiscount.findMany({
          where: { productId },
          orderBy: { minQty: 'asc' },
        })
      : [];

    // Build subscription options
    const subscriptionOptions = config.showSubscription
      ? Object.entries(FREQUENCY_DISCOUNTS).map(([frequency, discount]) => ({
          frequency,
          discountPercent: discount,
        }))
      : [];

    return NextResponse.json({
      enabled: true,
      showQuantityDiscount: config.showQuantityDiscount && quantityDiscounts.length > 0,
      showSubscription: config.showSubscription,
      displayRule: config.displayRule,
      quantityTitle: config.quantityTitle,
      quantitySubtitle: config.quantitySubtitle,
      subscriptionTitle: config.subscriptionTitle,
      subscriptionSubtitle: config.subscriptionSubtitle,
      suggestedQuantity: config.suggestedQuantity,
      suggestedFrequency: config.suggestedFrequency,
      quantityDiscounts: quantityDiscounts.map((qd) => ({
        minQty: qd.minQty,
        maxQty: qd.maxQty,
        discount: Number(qd.discount),
      })),
      subscriptionOptions,
    });
  } catch (error) {
    logger.error('Error fetching upsell config', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ enabled: false });
  }
}

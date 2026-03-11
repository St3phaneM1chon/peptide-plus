/**
 * Pricing Service — Dynamic Pricing per Loyalty Tier
 *
 * Resolves the effective price for a product based on the user's loyalty tier.
 * Priority order:
 *   1. ProductTierPrice (product-specific override per tier)
 *   2. LoyaltyTierConfig.discountPercent (general tier-wide discount)
 *   3. Base product price (no discount)
 */

import { prisma } from '@/lib/db';
import { Decimal } from '@prisma/client/runtime/library';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TierPriceResult {
  basePrice: Decimal;
  tierPrice: Decimal | null;
  discountPercent: Decimal;
  effectivePrice: Decimal;
  tierName: string;
  savings: Decimal;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);

function decimalRound2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

// ---------------------------------------------------------------------------
// Single product price
// ---------------------------------------------------------------------------

/**
 * Get the effective price for a product based on the user's loyalty tier.
 *
 * Resolution order:
 *   1. Active ProductTierPrice for (productId, tierName) whose date range covers now
 *   2. LoyaltyTierConfig.discountPercent applied to the base price
 *   3. Base product price (fallback — no discount)
 */
export async function getEffectivePrice(
  productId: string,
  tierName: string = 'BRONZE'
): Promise<TierPriceResult> {
  const now = new Date();

  // Fetch product base price, any matching tier-specific price, and tier config
  // in parallel.
  const [product, tierPrice, tierConfig] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      select: { price: true },
    }),
    prisma.productTierPrice.findFirst({
      where: {
        productId,
        tierName,
        active: true,
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
    }),
    prisma.loyaltyTierConfig.findUnique({
      where: { name: tierName },
    }),
  ]);

  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const basePrice = new Decimal(product.price.toString());

  // 1. Product-specific tier price takes precedence
  if (tierPrice) {
    const specific = new Decimal(tierPrice.price.toString());
    const savings = decimalRound2(basePrice.minus(specific));
    const discountPct = basePrice.gt(ZERO)
      ? decimalRound2(savings.div(basePrice).times(HUNDRED))
      : ZERO;

    return {
      basePrice,
      tierPrice: specific,
      discountPercent: discountPct,
      effectivePrice: specific,
      tierName,
      savings: savings.lt(ZERO) ? ZERO : savings,
    };
  }

  // 2. General tier discount
  if (tierConfig && new Decimal(tierConfig.discountPercent.toString()).gt(ZERO)) {
    const pct = new Decimal(tierConfig.discountPercent.toString());
    const discount = decimalRound2(basePrice.times(pct).div(HUNDRED));
    const effective = decimalRound2(basePrice.minus(discount));

    return {
      basePrice,
      tierPrice: null,
      discountPercent: pct,
      effectivePrice: effective.lt(ZERO) ? ZERO : effective,
      tierName,
      savings: discount,
    };
  }

  // 3. No discount
  return {
    basePrice,
    tierPrice: null,
    discountPercent: ZERO,
    effectivePrice: basePrice,
    tierName,
    savings: ZERO,
  };
}

// ---------------------------------------------------------------------------
// Batch product prices (for cart / listing pages)
// ---------------------------------------------------------------------------

/**
 * Get effective prices for multiple products in a single batch.
 * Uses two queries (products + tier prices) instead of N+1.
 */
export async function getEffectivePrices(
  productIds: string[],
  tierName: string = 'BRONZE'
): Promise<Map<string, TierPriceResult>> {
  if (productIds.length === 0) {
    return new Map();
  }

  const now = new Date();

  const [products, tierPrices, tierConfig] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, price: true },
    }),
    prisma.productTierPrice.findMany({
      where: {
        productId: { in: productIds },
        tierName,
        active: true,
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } },
        ],
      },
    }),
    prisma.loyaltyTierConfig.findUnique({
      where: { name: tierName },
    }),
  ]);

  // Index tier prices by productId for O(1) lookup
  const tierPriceMap = new Map(tierPrices.map(tp => [tp.productId, tp]));

  const generalPct = tierConfig
    ? new Decimal(tierConfig.discountPercent.toString())
    : ZERO;

  const result = new Map<string, TierPriceResult>();

  for (const product of products) {
    const basePrice = new Decimal(product.price.toString());
    const specificTierPrice = tierPriceMap.get(product.id);

    if (specificTierPrice) {
      // Product-specific tier price
      const specific = new Decimal(specificTierPrice.price.toString());
      const savings = decimalRound2(basePrice.minus(specific));
      const discountPct = basePrice.gt(ZERO)
        ? decimalRound2(savings.div(basePrice).times(HUNDRED))
        : ZERO;

      result.set(product.id, {
        basePrice,
        tierPrice: specific,
        discountPercent: discountPct,
        effectivePrice: specific,
        tierName,
        savings: savings.lt(ZERO) ? ZERO : savings,
      });
    } else if (generalPct.gt(ZERO)) {
      // General tier discount
      const discount = decimalRound2(basePrice.times(generalPct).div(HUNDRED));
      const effective = decimalRound2(basePrice.minus(discount));

      result.set(product.id, {
        basePrice,
        tierPrice: null,
        discountPercent: generalPct,
        effectivePrice: effective.lt(ZERO) ? ZERO : effective,
        tierName,
        savings: discount,
      });
    } else {
      // No discount
      result.set(product.id, {
        basePrice,
        tierPrice: null,
        discountPercent: ZERO,
        effectivePrice: basePrice,
        tierName,
        savings: ZERO,
      });
    }
  }

  return result;
}

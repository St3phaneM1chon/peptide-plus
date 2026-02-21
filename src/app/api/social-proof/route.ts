export const dynamic = 'force-dynamic';
/**
 * API - Social Proof Notifications
 * Returns recent purchases (anonymized) for social proof popups.
 *
 * Shows "X from City just purchased Product Y" notifications.
 * - Only returns completed orders/purchases from the last 48 hours
 * - Anonymizes user data (first name only, city only)
 * - Falls back to synthetic data if no recent real purchases exist
 * - No authentication required (public endpoint)
 * - Cached response to minimize DB load
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface SocialProofEntry {
  firstName: string;
  city: string;
  productName: string;
  productSlug: string;
  minutesAgo: number;
}

// In-memory cache to avoid hammering the DB on every request
let cachedData: SocialProofEntry[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    const now = Date.now();

    // Return cached data if still fresh
    if (cachedData && now - cacheTimestamp < CACHE_TTL_MS) {
      return NextResponse.json(cachedData);
    }

    const twoDaysAgo = new Date(now - 48 * 60 * 60 * 1000);

    // Strategy 1: Try to get recent orders (they have shipping city)
    // Note: OrderItem stores denormalized productName/productId but has no
    // direct product relation, so we look up slugs separately.
    const recentOrders = await prisma.order.findMany({
      where: {
        status: { in: ['COMPLETED', 'SHIPPED', 'DELIVERED', 'PROCESSING'] },
        paymentStatus: 'PAID',
        createdAt: { gte: twoDaysAgo },
      },
      select: {
        createdAt: true,
        shippingCity: true,
        shippingName: true,
        items: {
          select: {
            productId: true,
            productName: true,
          },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const entries: SocialProofEntry[] = [];

    // Collect product IDs to fetch slugs in a single query
    const productIds = recentOrders
      .map((o) => o.items[0]?.productId)
      .filter((id): id is string => !!id);

    const productSlugMap = new Map<string, string>();
    if (productIds.length > 0) {
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, slug: true },
      });
      for (const p of products) {
        productSlugMap.set(p.id, p.slug);
      }
    }

    for (const order of recentOrders) {
      const item = order.items[0];
      if (!item) continue;

      // Extract first name from shipping name (anonymize)
      const firstName = extractFirstName(order.shippingName);
      if (!firstName) continue;

      const minutesAgo = Math.round(
        (now - order.createdAt.getTime()) / (60 * 1000)
      );

      entries.push({
        firstName,
        city: order.shippingCity || 'Montreal',
        productName: item.productName,
        productSlug: productSlugMap.get(item.productId) || '',
        minutesAgo: Math.min(minutesAgo, 120), // Cap at 2 hours for display
      });
    }

    // Strategy 2: If no recent orders, try purchases
    if (entries.length === 0) {
      const recentPurchases = await prisma.purchase.findMany({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: twoDaysAgo },
        },
        select: {
          createdAt: true,
          user: {
            select: {
              name: true,
              addresses: {
                where: { isDefault: true },
                select: { city: true },
                take: 1,
              },
            },
          },
          product: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      for (const purchase of recentPurchases) {
        const firstName = extractFirstName(purchase.user?.name);
        if (!firstName) continue;

        const city =
          purchase.user?.addresses?.[0]?.city || 'Montreal';

        const minutesAgo = Math.round(
          (now - purchase.createdAt.getTime()) / (60 * 1000)
        );

        entries.push({
          firstName,
          city,
          productName: purchase.product?.name || 'Product',
          productSlug: purchase.product?.slug || '',
          minutesAgo: Math.min(minutesAgo, 120),
        });
      }
    }

    // Strategy 3: If still no data, return synthetic entries for social proof
    // This is common for new stores or low-traffic periods
    if (entries.length === 0) {
      const syntheticEntries = await generateSyntheticEntries();
      cachedData = syntheticEntries;
      cacheTimestamp = now;
      return NextResponse.json(syntheticEntries);
    }

    cachedData = entries;
    cacheTimestamp = now;

    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching social proof data:', error);
    // Return empty array on error - social proof is non-critical
    return NextResponse.json([]);
  }
}

/**
 * Extract first name from a full name string.
 * Returns null if name is empty/undefined.
 */
function extractFirstName(name: string | null | undefined): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/);
  const first = parts[0];
  if (!first || first.length < 2) return null;
  // Capitalize first letter
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/**
 * Generate synthetic social proof entries using real products from the DB.
 * Used when no recent purchases exist to maintain social proof presence.
 */
async function generateSyntheticEntries(): Promise<SocialProofEntry[]> {
  const CANADIAN_CITIES = [
    'Montreal', 'Toronto', 'Vancouver', 'Ottawa', 'Calgary',
    'Edmonton', 'Quebec City', 'Winnipeg', 'Halifax', 'Victoria',
  ];

  const FIRST_NAMES = [
    'Marc', 'Sophie', 'Jean', 'Marie', 'Pierre',
    'Isabelle', 'Nicolas', 'Julie', 'David', 'Catherine',
    'Alex', 'Sarah', 'Michael', 'Emma', 'Lucas',
  ];

  try {
    // Fetch a few active products to use in synthetic entries
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { name: true, slug: true },
      take: 8,
      orderBy: { purchaseCount: 'desc' },
    });

    if (products.length === 0) return [];

    const entries: SocialProofEntry[] = [];
    const count = Math.min(products.length, 5);

    for (let i = 0; i < count; i++) {
      const product = products[i % products.length];
      entries.push({
        firstName: FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)],
        city: CANADIAN_CITIES[Math.floor(Math.random() * CANADIAN_CITIES.length)],
        productName: product.name,
        productSlug: product.slug,
        // Random time between 5 and 90 minutes ago
        minutesAgo: Math.floor(Math.random() * 85) + 5,
      });
    }

    return entries;
  } catch {
    return [];
  }
}

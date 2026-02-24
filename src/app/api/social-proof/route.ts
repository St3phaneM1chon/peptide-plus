export const dynamic = 'force-dynamic';
import { logger } from '@/lib/logger';
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

// TODO: FLAW-056 - In-memory cache resets on serverless cold starts; consider Redis for shared cache
// FIX: FLAW-087 - TODO: Make cache locale-aware (use Map<locale, SocialProofEntry[]>) if content differs by locale
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

    // FLAW-001 FIX: Removed fake/synthetic social proof generation entirely.
    // Generating fake purchase notifications with synthetic names/cities is potentially illegal
    // under FTC Act Section 5 and Canadian Competition Act. Return empty array instead.
    // If no real recent purchases exist, return empty — the frontend should handle this gracefully.

    cachedData = entries;
    cacheTimestamp = now;

    return NextResponse.json(entries);
  } catch (error) {
    logger.error('Error fetching social proof data', { error: error instanceof Error ? error.message : String(error) });
    // Return empty array on error - social proof is non-critical, but include error field
    return NextResponse.json({ error: 'Failed to fetch social proof data', data: [] }, { status: 500 });
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

// FLAW-001: Removed generateSyntheticEntries function entirely.
// Fake social proof with synthetic names/cities violates consumer protection laws.

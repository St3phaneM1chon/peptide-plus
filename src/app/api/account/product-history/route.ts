export const dynamic = 'force-dynamic';

/**
 * API Historique produits agrégé
 * GET /api/account/product-history - Tous les produits commandés par le client, groupés par catégorie
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // PERF-003: Push aggregation to database using groupBy instead of loading all orders into JS
    const aggregated = await db.orderItem.groupBy({
      by: ['productId', 'formatId', 'productName', 'formatName'],
      where: {
        order: {
          userId: user.id,
          status: { not: 'CANCELLED' },
        },
      },
      _sum: { quantity: true },
      _count: { _all: true },
      _max: { createdAt: true },
    });

    if (aggregated.length === 0) {
      return NextResponse.json({ categories: [] });
    }

    // Extract unique product IDs from aggregation results
    const productIds = [...new Set(aggregated.map((g) => g.productId))];
    const formatIds = [...new Set(aggregated.map((g) => g.formatId).filter(Boolean))] as string[];

    // P-15 FIX: Replace N individual findFirst queries with a single $queryRaw that fetches
    // the most recent unitPrice per (productId, formatId) group in one DB round-trip.
    // DISTINCT ON orders by (productId, formatId, createdAt DESC) to get the latest row per pair.
    type LatestPriceRow = { productId: string; formatId: string | null; unitPrice: string };
    const latestPriceRows = await db.$queryRaw<LatestPriceRow[]>`
      SELECT DISTINCT ON ("productId", "formatId") "productId", "formatId", "unitPrice"
      FROM "OrderItem" oi
      WHERE oi."productId" = ANY(${productIds}::text[])
        AND EXISTS (
          SELECT 1 FROM "Order" o
          WHERE o."id" = oi."orderId"
            AND o."userId" = ${user.id}
            AND o."status" != 'CANCELLED'
        )
      ORDER BY "productId", "formatId", "createdAt" DESC
    `;

    // Index latest prices by "productId__formatId" composite key for O(1) lookup
    const latestPriceMap = new Map<string, number>();
    for (const row of latestPriceRows) {
      const key = `${row.productId}__${row.formatId ?? 'null'}`;
      if (!latestPriceMap.has(key)) {
        latestPriceMap.set(key, Number(row.unitPrice));
      }
    }

    // Build productMap from aggregated data
    const productMap = new Map<
      string,
      {
        productId: string;
        formatId: string | null;
        productName: string;
        formatName: string | null;
        totalOrdered: number;
        orderCount: number;
        lastOrderDate: string;
        lastOrderedPrice: number;
      }
    >();

    for (const group of aggregated) {
      const key = `${group.productId}__${group.formatId || 'null'}`;
      productMap.set(key, {
        productId: group.productId,
        formatId: group.formatId,
        productName: group.productName,
        formatName: group.formatName,
        totalOrdered: group._sum.quantity || 0,
        orderCount: group._count._all,
        lastOrderDate: group._max.createdAt?.toISOString() || new Date().toISOString(),
        lastOrderedPrice: latestPriceMap.get(key) ?? 0,
      });
    }

    // P-15 FIX: Use select to fetch only the fields actually used in the response,
    // avoiding loading heavy columns (description, specifications, aminoSequence, etc.)
    const [products, formats] = await Promise.all([
      db.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          imageUrl: true,
          slug: true,
          price: true,
          isActive: true,
          category: { select: { id: true, name: true } },
        },
      }),
      formatIds.length > 0
        ? db.productFormat.findMany({
            where: { id: { in: formatIds } },
            select: {
              id: true,
              price: true,
              inStock: true,
              isActive: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const productLookup = new Map(products.map((p) => [p.id, p]));
    const formatLookup = new Map(formats.map((f) => [f.id, f]));

    // Build category-grouped result
    const categoryMap = new Map<
      string,
      {
        id: string;
        name: string;
        products: Array<{
          productId: string;
          formatId: string | null;
          productName: string;
          formatName: string | null;
          imageUrl: string | null;
          slug: string;
          currentPrice: number;
          lastOrderedPrice: number;
          totalOrdered: number;
          orderCount: number;
          lastOrderDate: string;
          inStock: boolean;
          isActive: boolean;
        }>;
      }
    >();

    for (const item of productMap.values()) {
      const product = productLookup.get(item.productId);
      if (!product) continue;

      const format = item.formatId ? formatLookup.get(item.formatId) : null;
      const categoryId = product.category?.id || 'uncategorized';
      const categoryName = product.category?.name || 'Autres';

      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, { id: categoryId, name: categoryName, products: [] });
      }

      categoryMap.get(categoryId)!.products.push({
        productId: item.productId,
        formatId: item.formatId,
        productName: item.productName,
        formatName: item.formatName,
        imageUrl: product.imageUrl,
        slug: product.slug,
        currentPrice: format ? Number(format.price) : Number(product.price),
        lastOrderedPrice: item.lastOrderedPrice,
        totalOrdered: item.totalOrdered,
        orderCount: item.orderCount,
        lastOrderDate: item.lastOrderDate,
        inStock: format ? format.inStock : true,
        isActive: product.isActive && (format ? format.isActive : true),
      });
    }

    // Sort products within categories by order count desc
    const categories = [...categoryMap.values()].map((cat) => ({
      ...cat,
      products: cat.products.sort((a, b) => b.orderCount - a.orderCount),
    }));

    return NextResponse.json({ categories });
  } catch (error) {
    logger.error('Error fetching product history', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'historique produits' },
      { status: 500 }
    );
  }
}

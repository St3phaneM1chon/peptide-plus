export const dynamic = 'force-dynamic';

/**
 * API Historique produits agrégé
 * GET /api/account/product-history - Tous les produits commandés par le client, groupés par catégorie
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUserGuard } from '@/lib/user-api-guard';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { tenantQueryRaw } from '@/lib/tenant-raw-query';

export const GET = withUserGuard(async (_request: NextRequest, { session }) => {
  try {

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // PERF-003: Push aggregation to database using groupBy instead of loading all orders into JS
    const aggregated = await db.orderItem.groupBy({
      by: ['productId', 'optionId', 'productName', 'optionName'],
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
    const optionIds = [...new Set(aggregated.map((g) => g.optionId).filter(Boolean))] as string[];

    // P-15 FIX: Replace N individual findFirst queries with a single query that fetches
    // the most recent unitPrice per (productId, optionId) group in one DB round-trip.
    // DISTINCT ON orders by (productId, optionId, createdAt DESC) to get the latest row per pair.
    type LatestPriceRow = { productId: string; optionId: string | null; unitPrice: string };
    const latestPriceRows = await tenantQueryRaw<LatestPriceRow>(
      `SELECT DISTINCT ON ("productId", "optionId") "productId", "optionId", "unitPrice"
      FROM "OrderItem" oi
      WHERE oi."productId" = ANY($1::text[])
        AND EXISTS (
          SELECT 1 FROM "Order" o
          WHERE o."id" = oi."orderId"
            AND o."userId" = $2
            AND o."status" != 'CANCELLED'
        )
      ORDER BY "productId", "optionId", "createdAt" DESC`,
      productIds,
      user.id
    );

    // Index latest prices by "productId__optionId" composite key for O(1) lookup
    const latestPriceMap = new Map<string, number>();
    for (const row of latestPriceRows) {
      const key = `${row.productId}__${row.optionId ?? 'null'}`;
      if (!latestPriceMap.has(key)) {
        latestPriceMap.set(key, Number(row.unitPrice));
      }
    }

    // Build productMap from aggregated data
    const productMap = new Map<
      string,
      {
        productId: string;
        optionId: string | null;
        productName: string;
        optionName: string | null;
        totalOrdered: number;
        orderCount: number;
        lastOrderDate: string;
        lastOrderedPrice: number;
      }
    >();

    for (const group of aggregated) {
      const key = `${group.productId}__${group.optionId || 'null'}`;
      productMap.set(key, {
        productId: group.productId,
        optionId: group.optionId,
        productName: group.productName,
        optionName: group.optionName,
        totalOrdered: group._sum.quantity || 0,
        orderCount: group._count._all,
        lastOrderDate: group._max.createdAt?.toISOString() || new Date().toISOString(),
        lastOrderedPrice: latestPriceMap.get(key) ?? 0,
      });
    }

    // P-15 FIX: Use select to fetch only the fields actually used in the response,
    // avoiding loading heavy columns (description, specifications, aminoSequence, etc.)
    const [products, options] = await Promise.all([
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
      optionIds.length > 0
        ? db.productOption.findMany({
            where: { id: { in: optionIds } },
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
    const formatLookup = new Map(options.map((f) => [f.id, f]));

    // Build category-grouped result
    const categoryMap = new Map<
      string,
      {
        id: string;
        name: string;
        products: Array<{
          productId: string;
          optionId: string | null;
          productName: string;
          optionName: string | null;
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

      const format = item.optionId ? formatLookup.get(item.optionId) : null;
      const categoryId = product.category?.id || 'uncategorized';
      const categoryName = product.category?.name || 'Autres';

      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, { id: categoryId, name: categoryName, products: [] });
      }

      categoryMap.get(categoryId)!.products.push({
        productId: item.productId,
        optionId: item.optionId,
        productName: item.productName,
        optionName: item.optionName,
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
}, { skipCsrf: true });

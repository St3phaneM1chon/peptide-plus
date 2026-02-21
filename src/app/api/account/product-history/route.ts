export const dynamic = 'force-dynamic';

/**
 * API Historique produits agrégé
 * GET /api/account/product-history - Tous les produits commandés par le client, groupés par catégorie
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';

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

    // For lastOrderedPrice, fetch the most recent order item per (productId, formatId) group.
    // This is still much cheaper than loading all 200 orders with all items.
    const latestPricePromises = aggregated.map((group) =>
      db.orderItem.findFirst({
        where: {
          productId: group.productId,
          formatId: group.formatId,
          order: {
            userId: user.id,
            status: { not: 'CANCELLED' },
          },
        },
        orderBy: { createdAt: 'desc' },
        select: { unitPrice: true },
      })
    );

    const latestPrices = await Promise.all(latestPricePromises);

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

    for (let i = 0; i < aggregated.length; i++) {
      const group = aggregated[i];
      const key = `${group.productId}__${group.formatId || 'null'}`;
      productMap.set(key, {
        productId: group.productId,
        formatId: group.formatId,
        productName: group.productName,
        formatName: group.formatName,
        totalOrdered: group._sum.quantity || 0,
        orderCount: group._count._all,
        lastOrderDate: group._max.createdAt?.toISOString() || new Date().toISOString(),
        lastOrderedPrice: latestPrices[i]?.unitPrice ? Number(latestPrices[i]!.unitPrice) : 0,
      });
    }

    // Get product details for all unique product IDs
    const productIds = [...new Set(aggregated.map((g) => g.productId))];
    const formatIds = [...new Set(aggregated.map((g) => g.formatId).filter(Boolean))] as string[];

    const [products, formats] = await Promise.all([
      db.product.findMany({
        where: { id: { in: productIds } },
        include: { category: { select: { id: true, name: true } } },
      }),
      formatIds.length > 0
        ? db.productFormat.findMany({
            where: { id: { in: formatIds } },
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
    console.error('Error fetching product history:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'historique produits' },
      { status: 500 }
    );
  }
}

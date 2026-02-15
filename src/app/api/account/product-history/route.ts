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

    // Get all order items from non-cancelled orders
    const orders = await db.order.findMany({
      where: {
        userId: user.id,
        status: { not: 'CANCELLED' },
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate by productId + formatId
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

    for (const order of orders) {
      for (const item of order.items) {
        const key = `${item.productId}__${item.formatId || 'null'}`;
        const existing = productMap.get(key);

        if (existing) {
          existing.totalOrdered += item.quantity;
          existing.orderCount += 1;
          if (order.createdAt.toISOString() > existing.lastOrderDate) {
            existing.lastOrderDate = order.createdAt.toISOString();
            existing.lastOrderedPrice = Number(item.unitPrice);
          }
        } else {
          productMap.set(key, {
            productId: item.productId,
            formatId: item.formatId,
            productName: item.productName,
            formatName: item.formatName,
            totalOrdered: item.quantity,
            orderCount: 1,
            lastOrderDate: order.createdAt.toISOString(),
            lastOrderedPrice: Number(item.unitPrice),
          });
        }
      }
    }

    // Get product details for all unique product IDs
    const productIds = [...new Set([...productMap.values()].map((p) => p.productId))];
    const formatIds = [...new Set([...productMap.values()].map((p) => p.formatId).filter(Boolean))] as string[];

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

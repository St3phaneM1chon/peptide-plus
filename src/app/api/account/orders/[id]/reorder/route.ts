export const dynamic = 'force-dynamic';

/**
 * API Reorder - Reconstruit un panier à partir d'une commande existante
 * POST /api/account/orders/[id]/reorder
 *
 * Returns:
 *   { items: ReorderItem[], skipped: SkippedItem[] }
 *
 * - items: products/formats that are still available and can be added to cart
 * - skipped: items that could not be re-ordered, with a reason string
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

interface ReorderItem {
  productId: string;
  formatId: string | null;
  slug: string;
  name: string;
  formatName: string | null;
  quantity: number;
  price: number;
  image: string | null;
}

interface SkippedItem {
  productId: string;
  formatId: string | null;
  name: string;
  reason: string;
}

export const POST = withUserGuard(async (request: NextRequest, { session, params }) => {
  try {
    // Rate limiting for payment-related endpoint
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/account/orders/reorder');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const orderId = params?.id;

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch the order with items, ensuring it belongs to the authenticated user
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: user.id,
      },
      include: {
        items: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Collect all product IDs and format IDs from the order
    const productIds = order.items.map((item) => item.productId);
    const formatIds = order.items
      .map((item) => item.formatId)
      .filter((id): id is string => id !== null);

    // Fetch current product data to validate availability
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        isActive: true,
        price: true,
        formats: {
          where: formatIds.length > 0 ? { id: { in: formatIds } } : undefined,
          select: {
            id: true,
            name: true,
            price: true,
            isActive: true,
            inStock: true,
            availability: true,
            stockQuantity: true,
          },
        },
      },
    });

    // Build a lookup map for products
    const productMap = new Map(products.map((p) => [p.id, p]));

    const items: ReorderItem[] = [];
    const skipped: SkippedItem[] = [];

    for (const item of order.items) {
      const product = productMap.get(item.productId);

      // Product no longer exists or is inactive
      if (!product) {
        skipped.push({
          productId: item.productId,
          formatId: item.formatId,
          name: item.productName + (item.formatName ? ` - ${item.formatName}` : ''),
          reason: 'product_not_found',
        });
        continue;
      }

      if (!product.isActive) {
        skipped.push({
          productId: item.productId,
          formatId: item.formatId,
          name: item.productName + (item.formatName ? ` - ${item.formatName}` : ''),
          reason: 'product_unavailable',
        });
        continue;
      }

      // If the order item had a specific format
      if (item.formatId) {
        const format = product.formats.find((f) => f.id === item.formatId);

        // Format no longer exists
        if (!format) {
          skipped.push({
            productId: item.productId,
            formatId: item.formatId,
            name: `${item.productName} - ${item.formatName || 'Unknown format'}`,
            reason: 'format_not_found',
          });
          continue;
        }

        // Format is inactive
        if (!format.isActive) {
          skipped.push({
            productId: item.productId,
            formatId: item.formatId,
            name: `${item.productName} - ${format.name}`,
            reason: 'format_unavailable',
          });
          continue;
        }

        // Format is discontinued
        if (format.availability === 'DISCONTINUED') {
          skipped.push({
            productId: item.productId,
            formatId: item.formatId,
            name: `${item.productName} - ${format.name}`,
            reason: 'discontinued',
          });
          continue;
        }

        // Format is out of stock
        if (!format.inStock || format.availability === 'OUT_OF_STOCK') {
          skipped.push({
            productId: item.productId,
            formatId: item.formatId,
            name: `${item.productName} - ${format.name}`,
            reason: 'out_of_stock',
          });
          continue;
        }

        items.push({
          productId: product.id,
          formatId: format.id,
          slug: product.slug,
          name: product.name,
          formatName: format.name,
          quantity: item.quantity,
          price: Number(format.price),
          image: product.imageUrl,
        });
      } else {
        // Product without a specific format — use base product price
        items.push({
          productId: product.id,
          formatId: null,
          slug: product.slug,
          name: product.name,
          formatName: null,
          quantity: item.quantity,
          price: Number(product.price),
          image: product.imageUrl,
        });
      }
    }

    return NextResponse.json({ items, skipped });
  } catch (error) {
    logger.error('Reorder error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

export const dynamic = 'force-dynamic';

/**
 * API Reorder - Reconstruit un panier à partir d'une commande existante
 * POST /api/account/orders/[id]/reorder
 *
 * Returns:
 *   { items: ReorderItem[], skipped: SkippedItem[] }
 *
 * - items: products/options that are still available and can be added to cart
 * - skipped: items that could not be re-ordered, with a reason string
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { getClientIpFromRequest } from '@/lib/admin-audit';
import { validateCsrf } from '@/lib/csrf-middleware';

interface ReorderItem {
  productId: string;
  optionId: string | null;
  slug: string;
  name: string;
  optionName: string | null;
  quantity: number;
  price: number;
  image: string | null;
}

interface SkippedItem {
  productId: string;
  optionId: string | null;
  name: string;
  reason: string;
}

export const POST = withUserGuard(async (request: NextRequest, { session, params }) => {
  try {
    // Rate limiting for payment-related endpoint
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/account/orders/reorder');
    if (!rl.success) {
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
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
    const optionIds = order.items
      .map((item) => item.optionId)
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
        options: {
          where: optionIds.length > 0 ? { id: { in: optionIds } } : undefined,
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
          optionId: item.optionId,
          name: item.productName + (item.optionName ? ` - ${item.optionName}` : ''),
          reason: 'product_not_found',
        });
        continue;
      }

      if (!product.isActive) {
        skipped.push({
          productId: item.productId,
          optionId: item.optionId,
          name: item.productName + (item.optionName ? ` - ${item.optionName}` : ''),
          reason: 'product_unavailable',
        });
        continue;
      }

      // If the order item had a specific format
      if (item.optionId) {
        const format = product.options.find((f) => f.id === item.optionId);

        // Format no longer exists
        if (!format) {
          skipped.push({
            productId: item.productId,
            optionId: item.optionId,
            name: `${item.productName} - ${item.optionName || 'Unknown format'}`,
            reason: 'option_not_found',
          });
          continue;
        }

        // Format is inactive
        if (!format.isActive) {
          skipped.push({
            productId: item.productId,
            optionId: item.optionId,
            name: `${item.productName} - ${format.name}`,
            reason: 'option_unavailable',
          });
          continue;
        }

        // Format is discontinued
        if (format.availability === 'DISCONTINUED') {
          skipped.push({
            productId: item.productId,
            optionId: item.optionId,
            name: `${item.productName} - ${format.name}`,
            reason: 'discontinued',
          });
          continue;
        }

        // Format is out of stock
        if (!format.inStock || format.availability === 'OUT_OF_STOCK') {
          skipped.push({
            productId: item.productId,
            optionId: item.optionId,
            name: `${item.productName} - ${format.name}`,
            reason: 'out_of_stock',
          });
          continue;
        }

        items.push({
          productId: product.id,
          optionId: format.id,
          slug: product.slug,
          name: product.name,
          optionName: format.name,
          quantity: item.quantity,
          price: Number(format.price),
          image: product.imageUrl,
        });
      } else {
        // Product without a specific format — use base product price
        items.push({
          productId: product.id,
          optionId: null,
          slug: product.slug,
          name: product.name,
          optionName: null,
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

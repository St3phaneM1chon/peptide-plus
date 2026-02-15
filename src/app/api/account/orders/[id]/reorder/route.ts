export const dynamic = 'force-dynamic';

/**
 * API Reorder - Reconstruit un panier à partir d'une commande existante
 * POST /api/account/orders/[id]/reorder
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: orderId } = await params;

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

    const availableItems: ReorderItem[] = [];
    const unavailable: string[] = [];

    for (const item of order.items) {
      const product = productMap.get(item.productId);

      // Product no longer exists or is inactive
      if (!product || !product.isActive) {
        unavailable.push(item.productName + (item.formatName ? ` - ${item.formatName}` : ''));
        continue;
      }

      // If the order item had a specific format
      if (item.formatId) {
        const format = product.formats.find((f) => f.id === item.formatId);

        // Format no longer exists, is inactive, or out of stock
        if (!format || !format.isActive || !format.inStock || format.availability === 'OUT_OF_STOCK' || format.availability === 'DISCONTINUED') {
          unavailable.push(`${item.productName} - ${item.formatName || format?.name || 'Unknown format'}`);
          continue;
        }

        availableItems.push({
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
        availableItems.push({
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

    return NextResponse.json({
      items: availableItems,
      unavailable,
    });
  } catch (error) {
    console.error('Reorder error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

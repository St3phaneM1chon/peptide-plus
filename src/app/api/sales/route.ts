export const dynamic = 'force-dynamic';

/**
 * Mobile Sales API
 * GET /api/sales — List recent sales/orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { withMobileGuard } from '@/lib/mobile-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET — List recent orders/sales.
 */
export const GET = withMobileGuard(async (request, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        include: {
          user: { select: { name: true, email: true } },
          items: {
            include: {
              product: { select: { name: true } },
            },
          },
          currency: { select: { code: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.order.count(),
    ]);

    // Map to iOS Sale format
    const mapped = orders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: parseFloat(order.total.toString()),
      currency: order.currency?.code || 'CAD',
      customerName: order.user?.name || order.shippingName || null,
      customerEmail: order.user?.email || null,
      customerRegion: order.shippingState || null,
      itemCount: order.items.length,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map(item => ({
        id: item.id,
        productName: item.product?.name || item.productName || 'Product',
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice.toString()),
        totalPrice: parseFloat(item.totalPrice.toString()),
      })),
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    logger.error('[Sales] GET failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to list sales' }, { status: 500 });
  }
});

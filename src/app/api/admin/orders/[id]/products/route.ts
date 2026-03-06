export const dynamic = 'force-dynamic';

/**
 * Bridge #19: Commerce → Catalogue (Product links from order)
 * GET /api/admin/orders/[id]/products
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { isModuleEnabled } from '@/lib/module-flags';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const enabled = await isModuleEnabled('catalog');
    if (!enabled) return apiSuccess({ enabled: false }, { request });

    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        items: {
          select: { productId: true, productName: true, quantity: true, unitPrice: true },
        },
      },
    });
    if (!order) return apiError('Order not found', ErrorCode.NOT_FOUND, { request });

    const productIds = [...new Set(order.items.map((i) => i.productId))];
    if (productIds.length === 0) return apiSuccess({ enabled: true, products: [] }, { request });

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, slug: true, sku: true, isActive: true, price: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    return apiSuccess({
      enabled: true,
      products: order.items.map((item) => {
        const prod = productMap.get(item.productId);
        return {
          productId: item.productId,
          name: item.productName,
          slug: prod?.slug ?? null,
          sku: prod?.sku ?? null,
          isActive: prod?.isActive ?? null,
          currentPrice: prod ? Number(prod.price) : null,
          orderedPrice: Number(item.unitPrice),
          quantity: item.quantity,
        };
      }),
    }, { request });
  } catch (error) {
    logger.error('[orders/[id]/products] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch product links', ErrorCode.INTERNAL_ERROR, { request });
  }
});

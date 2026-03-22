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

    // Fetch products and their format-level stock in parallel
    const [products, options] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, slug: true, sku: true, isActive: true, price: true },
      }),
      prisma.productOption.findMany({
        where: { productId: { in: productIds } },
        select: {
          id: true,
          productId: true,
          name: true,
          sku: true,
          stockQuantity: true,
          inStock: true,
          availability: true,
        },
      }),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Group options by productId for quick lookup
    const optionsByProduct = new Map<string, typeof options>();
    for (const f of options) {
      const arr = optionsByProduct.get(f.productId) || [];
      arr.push(f);
      optionsByProduct.set(f.productId, arr);
    }

    return apiSuccess({
      enabled: true,
      products: order.items.map((item) => {
        const prod = productMap.get(item.productId);
        const prodOptions = optionsByProduct.get(item.productId) || [];
        const totalStock = prodOptions.reduce((sum, f) => sum + f.stockQuantity, 0);

        return {
          productId: item.productId,
          name: item.productName,
          slug: prod?.slug ?? null,
          sku: prod?.sku ?? null,
          isActive: prod?.isActive ?? null,
          currentPrice: prod ? Number(prod.price) : null,
          orderedPrice: Number(item.unitPrice),
          quantity: item.quantity,
          // A5-P2-005: Inventory data
          stock: {
            totalStock,
            options: prodOptions.map((f) => ({
              optionId: f.id,
              name: f.name,
              sku: f.sku,
              stockQuantity: f.stockQuantity,
              inStock: f.inStock,
              availability: f.availability,
            })),
          },
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

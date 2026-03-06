export const dynamic = 'force-dynamic';

/**
 * Bridge #25: Catalogue → Commerce
 * GET /api/admin/products/[id]/sales
 *
 * Returns sales stats for a product (units sold, revenue, recent orders).
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { isModuleEnabled } from '@/lib/module-flags';

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  const enabled = await isModuleEnabled('ecommerce');
  if (!enabled) return apiSuccess({ enabled: false }, { request });

  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!product) {
    return apiError('Product not found', ErrorCode.NOT_FOUND, { request });
  }

  const [itemAgg, revenueAgg, recentItems] = await Promise.all([
    prisma.orderItem.aggregate({
      where: { productId: id },
      _sum: { quantity: true },
      _count: true,
    }),
    prisma.orderItem.aggregate({
      where: { productId: id },
      _sum: { total: true },
    }),
    prisma.orderItem.findMany({
      where: { productId: id },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        createdAt: true,
        orderId: true,
        order: {
          select: { id: true, orderNumber: true, status: true, createdAt: true },
        },
      },
    }),
  ]);

  const totalUnitsSold = itemAgg._sum.quantity ?? 0;
  const totalOrders = itemAgg._count;
  const totalRevenue = Number(revenueAgg._sum.total ?? 0);

  return apiSuccess({
    enabled: true,
    totalUnitsSold,
    totalOrders,
    totalRevenue,
    recentOrders: recentItems.map((item) => ({
      orderId: item.order.id,
      orderNumber: item.order.orderNumber,
      orderStatus: item.order.status,
      quantity: item.quantity,
      price: Number(item.unitPrice),
      date: item.order.createdAt,
    })),
  }, { request });
});

export const dynamic = 'force-dynamic';

/**
 * Bridge #10: Marketing → Commerce
 * GET /api/admin/promo-codes/[id]/revenue
 *
 * Returns revenue, order count, and top products for a promo code.
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

  const promo = await prisma.promoCode.findUnique({
    where: { id },
    select: { id: true, code: true },
  });
  if (!promo) {
    return apiError('Promo code not found', ErrorCode.NOT_FOUND, { request });
  }

  // Get all usages with orderId
  const usages = await prisma.promoCodeUsage.findMany({
    where: { promoCodeId: id },
    select: { orderId: true, discount: true },
  });

  const orderIds = usages.map((u) => u.orderId).filter((oid): oid is string => !!oid);

  if (orderIds.length === 0) {
    return apiSuccess({ enabled: true, totalRevenue: 0, orderCount: 0, topProducts: [], recentOrders: [] }, { request });
  }

  // Fetch orders with their items
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      status: true,
      createdAt: true,
      items: {
        select: {
          quantity: true,
          unitPrice: true,
          productId: true,
          productName: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const orderCount = orders.length;

  // Top products by quantity
  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const existing = productMap.get(item.productId) || { name: item.productName, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += Number(item.unitPrice) * item.quantity;
      productMap.set(item.productId, existing);
    }
  }
  const topProducts = [...productMap.entries()]
    .sort((a, b) => b[1].quantity - a[1].quantity)
    .slice(0, 5)
    .map(([productId, data]) => ({ id: productId, ...data }));

  const recentOrders = orders.slice(0, 5).map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    total: Number(o.total),
    status: o.status,
    createdAt: o.createdAt,
  }));

  return apiSuccess({
    enabled: true,
    totalRevenue,
    orderCount,
    topProducts,
    recentOrders,
  }, { request });
});

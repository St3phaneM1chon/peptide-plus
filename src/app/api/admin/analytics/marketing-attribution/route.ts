export const dynamic = 'force-dynamic';

/**
 * Cross-Module Analytics #3: Marketing Attribution
 * GET /api/admin/analytics/marketing-attribution
 *
 * Promo code usage → orders → revenue. Crosses Marketing + Commerce + Accounting.
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess } from '@/lib/api-response';
import { getModuleFlags } from '@/lib/module-flags';

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params: _params }: { session: unknown; params: Promise<{ id?: string }> }
) => {
  const flags = await getModuleFlags(['marketing', 'ecommerce']);

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get('days') || '30', 10);
  const since = new Date();
  since.setDate(since.getDate() - days);

  if (!flags.marketing || !flags.ecommerce) {
    return apiSuccess({ enabled: false, modules: flags }, { request });
  }

  // ── Get all promo codes with usage counts ──
  const promoCodes = await prisma.promoCode.findMany({
    where: { isActive: true },
    include: {
      usages: {
        where: { usedAt: { gte: since } },
        select: { orderId: true, discount: true },
      },
    },
  });

  // ── Collect all orderIds from usages ──
  const allOrderIds = new Set<string>();
  for (const promo of promoCodes) {
    for (const usage of promo.usages) {
      if (usage.orderId) allOrderIds.add(usage.orderId);
    }
  }

  // ── Fetch orders ──
  const orders = allOrderIds.size > 0
    ? await prisma.order.findMany({
        where: { id: { in: [...allOrderIds] } },
        select: { id: true, total: true, status: true, paymentStatus: true },
      })
    : [];
  const orderMap = new Map(orders.map((o) => [o.id, o]));

  // ── Build per-promo attribution ──
  const promoStats = promoCodes
    .map((promo) => {
      const usageCount = promo.usages.length;
      const linkedOrders = promo.usages
        .map((u) => u.orderId ? orderMap.get(u.orderId) : null)
        .filter(Boolean);
      const revenue = linkedOrders.reduce((s, o) => s + Number(o!.total), 0);
      const paidOrders = linkedOrders.filter((o) => o!.paymentStatus === 'PAID').length;
      const totalDiscount = promo.usages.reduce((s, u) => s + Number(u.discount || 0), 0);

      return {
        id: promo.id,
        code: promo.code,
        type: promo.type,
        value: Number(promo.value),
        usageCount,
        orderCount: linkedOrders.length,
        paidOrders,
        revenue: Math.round(revenue * 100) / 100,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        roi: totalDiscount > 0 ? Math.round((revenue / totalDiscount) * 100) / 100 : 0,
      };
    })
    .filter((p) => p.usageCount > 0)
    .sort((a, b) => b.revenue - a.revenue);

  // ── Totals ──
  const totalUsages = promoStats.reduce((s, p) => s + p.usageCount, 0);
  const totalRevenue = promoStats.reduce((s, p) => s + p.revenue, 0);
  const totalDiscount = promoStats.reduce((s, p) => s + p.totalDiscount, 0);
  const totalOrders = promoStats.reduce((s, p) => s + p.orderCount, 0);

  // ── Orders without promo (organic) ──
  const totalAllOrders = await prisma.order.count({
    where: { createdAt: { gte: since } },
  });
  const organicOrders = totalAllOrders - totalOrders;

  return apiSuccess({
    enabled: true,
    period: { days, since: since.toISOString() },
    summary: {
      totalPromoRevenue: Math.round(totalRevenue * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      totalPromoUsages: totalUsages,
      promoOrders: totalOrders,
      organicOrders,
      promoSharePercent: totalAllOrders > 0 ? Math.round((totalOrders / totalAllOrders) * 1000) / 10 : 0,
      overallRoi: totalDiscount > 0 ? Math.round((totalRevenue / totalDiscount) * 100) / 100 : 0,
    },
    promoCodes: promoStats.slice(0, 20),
    modules: flags,
  }, { request });
});

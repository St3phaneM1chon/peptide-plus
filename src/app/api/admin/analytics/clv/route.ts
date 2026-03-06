export const dynamic = 'force-dynamic';

/**
 * Cross-Module Analytics #2: Customer Lifetime Value
 * GET /api/admin/analytics/clv
 *
 * Aggregates Commerce + Loyalty + CRM for a holistic CLV view.
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
  const flags = await getModuleFlags(['ecommerce', 'loyalty', 'crm']);

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

  // ── Top customers by total spend ──
  type CustomerSpend = { userId: string; _sum: { total: number | null }; _count: { id: number } };
  let topCustomers: Array<{
    userId: string;
    totalSpent: number;
    orderCount: number;
    loyaltyTier: string | null;
    loyaltyPoints: number;
    crmDeals: number;
    avgOrderValue: number;
    estimatedClv: number;
  }> = [];

  if (flags.ecommerce) {
    const spendData = await prisma.order.groupBy({
      by: ['userId'],
      where: { paymentStatus: 'PAID' },
      _sum: { total: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    }) as unknown as CustomerSpend[];

    const userIds = spendData.map((s) => s.userId);

    // Loyalty data
    let loyaltyMap = new Map<string, { tier: string | null; points: number }>();
    if (flags.loyalty && userIds.length > 0) {
      const loyaltyTxns = await prisma.loyaltyTransaction.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds } },
        _sum: { points: true },
      });
      for (const lt of loyaltyTxns) {
        loyaltyMap.set(lt.userId, { tier: null, points: lt._sum.points ?? 0 });
      }
    }

    // CRM deals count
    let dealCountMap = new Map<string, number>();
    if (flags.crm && userIds.length > 0) {
      const dealCounts = await prisma.crmDeal.groupBy({
        by: ['contactId'],
        where: { contactId: { in: userIds } },
        _count: { id: true },
      });
      for (const dc of dealCounts) {
        if (dc.contactId) dealCountMap.set(dc.contactId, dc._count.id);
      }
    }

    topCustomers = spendData.map((s) => {
      const totalSpent = Number(s._sum.total ?? 0);
      const orderCount = s._count.id;
      const avgOrderValue = orderCount > 0 ? totalSpent / orderCount : 0;
      const loyalty = loyaltyMap.get(s.userId);
      const crmDeals = dealCountMap.get(s.userId) ?? 0;

      // Simple CLV projection: avgOrderValue * estimated future orders (based on frequency)
      const estimatedClv = totalSpent * 2; // 2x current spend as simple projection

      return {
        userId: s.userId,
        totalSpent: Math.round(totalSpent * 100) / 100,
        orderCount,
        loyaltyTier: loyalty?.tier ?? null,
        loyaltyPoints: loyalty?.points ?? 0,
        crmDeals,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        estimatedClv: Math.round(estimatedClv * 100) / 100,
      };
    });
  }

  // ── Aggregate stats ──
  const totalCustomers = topCustomers.length;
  const avgClv = totalCustomers > 0
    ? topCustomers.reduce((s, c) => s + c.estimatedClv, 0) / totalCustomers
    : 0;
  const avgOrderValue = totalCustomers > 0
    ? topCustomers.reduce((s, c) => s + c.avgOrderValue, 0) / totalCustomers
    : 0;
  const totalRevenue = topCustomers.reduce((s, c) => s + c.totalSpent, 0);

  // ── CLV distribution buckets ──
  const buckets = [
    { label: '$0-100', min: 0, max: 100 },
    { label: '$100-500', min: 100, max: 500 },
    { label: '$500-1K', min: 500, max: 1000 },
    { label: '$1K-5K', min: 1000, max: 5000 },
    { label: '$5K+', min: 5000, max: Infinity },
  ];
  const distribution = buckets.map((b) => ({
    label: b.label,
    count: topCustomers.filter((c) => c.totalSpent >= b.min && c.totalSpent < b.max).length,
  }));

  return apiSuccess({
    summary: {
      totalCustomersAnalyzed: totalCustomers,
      avgClv: Math.round(avgClv * 100) / 100,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
    },
    distribution,
    topCustomers,
    modules: flags,
  }, { request });
});

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withAdminGuard(async () => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run all queries in parallel
    const [
      revenueTodayResult,
      revenueWeekResult,
      revenueMonthResult,
      ordersTodayCount,
      totalCustomers,
      newCustomersMonth,
      rfmData,
    ] = await Promise.all([
      // Revenue today
      prisma.order.aggregate({
        where: { createdAt: { gte: todayStart }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
      // Revenue this week
      prisma.order.aggregate({
        where: { createdAt: { gte: weekStart }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
      // Revenue this month
      prisma.order.aggregate({
        where: { createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } },
        _sum: { total: true },
      }),
      // Orders today
      prisma.order.count({
        where: { createdAt: { gte: todayStart } },
      }),
      // Total customers
      prisma.user.count({
        where: { role: 'CUSTOMER' },
      }),
      // New customers this month
      prisma.user.count({
        where: { role: 'CUSTOMER', createdAt: { gte: monthStart } },
      }),
      // RFM - get customers with metrics
      prisma.customerMetrics.groupBy({
        by: ['rfmSegment'],
        _count: { rfmSegment: true },
      }).catch(() => [] as { rfmSegment: string; _count: { rfmSegment: number } }[]),
    ]);

    // Build RFM distribution from real data (or zeros if no data)
    const rfmSegments = [
      'CHAMPIONS', 'LOYAL', 'POTENTIAL_LOYAL', 'NEW_CUSTOMERS', 'PROMISING',
      'NEED_ATTENTION', 'ABOUT_TO_SLEEP', 'AT_RISK', 'CANT_LOSE', 'HIBERNATING', 'LOST',
    ];
    const rfmDistribution: Record<string, number> = {};
    for (const seg of rfmSegments) {
      const found = (rfmData as { rfmSegment: string; _count: { rfmSegment: number } }[])
        .find((r) => r.rfmSegment === seg);
      rfmDistribution[seg] = found ? found._count.rfmSegment : 0;
    }

    return NextResponse.json({
      revenue: {
        today: Number(revenueTodayResult._sum.total ?? 0),
        thisWeek: Number(revenueWeekResult._sum.total ?? 0),
        thisMonth: Number(revenueMonthResult._sum.total ?? 0),
        ordersToday: ordersTodayCount,
      },
      customers: {
        total: totalCustomers,
        newThisMonth: newCustomersMonth,
      },
      rfmDistribution,
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    logger.error('[Admin Analytics] Error fetching analytics data', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
});

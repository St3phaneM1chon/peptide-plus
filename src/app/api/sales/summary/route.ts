export const dynamic = 'force-dynamic';

/**
 * Mobile Sales Summary API
 * GET /api/sales/summary — Revenue summary (today, week, month, year)
 */

import { NextResponse } from 'next/server';
import { withMobileGuard } from '@/lib/mobile-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const GET = withMobileGuard(async () => {
  try {
    const now = new Date();

    // Start of today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Start of week (Monday)
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - diffToMonday);

    // Start of month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Start of year
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Only count paid/confirmed/shipped/delivered orders
    const paidStatuses = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'PAID'];

    const baseWhere = {
      status: { in: paidStatuses },
    };

    const [todayAgg, weekAgg, monthAgg, yearAgg] = await Promise.all([
      prisma.order.aggregate({
        where: { ...baseWhere, createdAt: { gte: todayStart } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { ...baseWhere, createdAt: { gte: weekStart } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { ...baseWhere, createdAt: { gte: monthStart } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { ...baseWhere, createdAt: { gte: yearStart } },
        _sum: { total: true },
        _count: true,
      }),
    ]);

    return NextResponse.json({
      todayTotal: parseFloat(todayAgg._sum.total?.toString() || '0'),
      todayCount: todayAgg._count,
      weekTotal: parseFloat(weekAgg._sum.total?.toString() || '0'),
      weekCount: weekAgg._count,
      monthTotal: parseFloat(monthAgg._sum.total?.toString() || '0'),
      monthCount: monthAgg._count,
      yearTotal: parseFloat(yearAgg._sum.total?.toString() || '0'),
      yearCount: yearAgg._count,
      yearExpenses: 0, // TODO: Calculate from accounting when available
      currency: 'CAD',
    });
  } catch (error) {
    logger.error('[Sales Summary] GET failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to get sales summary' }, { status: 500 });
  }
});

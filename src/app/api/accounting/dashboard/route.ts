export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

// #99 In-memory cache for expensive dashboard aggregate queries.
// Dashboard data changes infrequently relative to how often it's fetched,
// so a short TTL significantly reduces database load.
const DASHBOARD_CACHE_TTL_MS = 60_000; // 1 minute cache
let dashboardCache: {
  data: Record<string, unknown>;
  timestamp: number;
  monthKey: string; // invalidate cache on month change
} | null = null;

// #31 Dashboard cache hit/miss counters
let dashboardCacheHits = 0;
let dashboardCacheMisses = 0;

/**
 * Phase 9: Invalidate dashboard cache.
 * Call this from any accounting write operation (POST/PUT/DELETE)
 * to ensure dashboard shows fresh data after mutations.
 */
export function invalidateDashboardCache(): void {
  dashboardCache = null;
}

/**
 * GET /api/accounting/dashboard
 * Returns accounting dashboard data
 * SECURITY: Requires EMPLOYEE or OWNER role
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const now = new Date();
    const { searchParams } = new URL(request.url);
    const skipCache = searchParams.get('refresh') === 'true';

    // Accept optional month/year params for historical view
    const paramMonth = searchParams.get('month');
    const paramYear = searchParams.get('year');
    const viewYear = paramYear ? parseInt(paramYear) : now.getFullYear();
    const viewMonth = paramMonth ? parseInt(paramMonth) - 1 : now.getMonth(); // 0-indexed
    const isHistorical = !!(paramMonth || paramYear);

    const currentMonthKey = `${viewYear}-${viewMonth}`;

    // #99 Return cached data if still fresh and same month (skip cache for historical views)
    if (
      !skipCache &&
      !isHistorical &&
      dashboardCache &&
      dashboardCache.monthKey === currentMonthKey &&
      Date.now() - dashboardCache.timestamp < DASHBOARD_CACHE_TTL_MS
    ) {
      dashboardCacheHits++;
      if ((dashboardCacheHits + dashboardCacheMisses) % 100 === 0) {
        console.info('Dashboard cache stats:', { hits: dashboardCacheHits, misses: dashboardCacheMisses });
      }
      return NextResponse.json({
        ...dashboardCache.data,
        cached: true,
        cachedAt: new Date(dashboardCache.timestamp).toISOString(),
      });
    }
    dashboardCacheMisses++;

    const startOfMonth = new Date(viewYear, viewMonth, 1);
    const endOfMonth = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59);

    // #61 Audit: Comparison periods for month-over-month and year-over-year
    const prevMonthStart = new Date(viewYear, viewMonth - 1, 1);
    const prevMonthEnd = new Date(viewYear, viewMonth, 0, 23, 59, 59);
    const prevYearStart = new Date(viewYear - 1, viewMonth, 1);
    const prevYearEnd = new Date(viewYear - 1, viewMonth + 1, 0, 23, 59, 59);

    const [
      revenueAgg,
      expenseAgg,
      pendingInvoices,
      bankAccounts,
      recentEntries,
      recentOrders,
      alerts,
      // Comparison period aggregates
      prevMonthRevenueAgg,
      prevMonthExpenseAgg,
      prevYearRevenueAgg,
      prevYearExpenseAgg,
    ] = await Promise.all([
      // Total revenue: aggregate sum instead of fetching all rows
      prisma.order.aggregate({
        where: {
          paymentStatus: 'PAID',
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { total: true },
      }),
      // Total expenses: aggregate sum instead of fetching all rows
      prisma.journalLine.aggregate({
        where: {
          account: { type: 'EXPENSE' },
          entry: {
            status: 'POSTED',
            deletedAt: null,
            date: { gte: startOfMonth, lte: endOfMonth },
          },
        },
        _sum: { debit: true },
      }),
      // Pending invoices count
      prisma.customerInvoice.count({
        where: { status: { in: ['SENT', 'OVERDUE'] }, deletedAt: null },
      }),
      // Bank balance
      prisma.bankAccount.findMany({
        where: { isActive: true },
        select: { currentBalance: true },
      }),
      // Recent entries
      prisma.journalEntry.findMany({
        where: { deletedAt: null },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          lines: {
            include: { account: { select: { code: true, name: true } } },
          },
        },
      }),
      // Recent orders
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      // Active alerts
      prisma.accountingAlert.findMany({
        where: { resolvedAt: null },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      // #61 Audit: Previous month revenue
      prisma.order.aggregate({
        where: {
          paymentStatus: 'PAID',
          createdAt: { gte: prevMonthStart, lte: prevMonthEnd },
        },
        _sum: { total: true },
      }),
      // #61 Audit: Previous month expenses
      prisma.journalLine.aggregate({
        where: {
          account: { type: 'EXPENSE' },
          entry: {
            status: 'POSTED',
            deletedAt: null,
            date: { gte: prevMonthStart, lte: prevMonthEnd },
          },
        },
        _sum: { debit: true },
      }),
      // #61 Audit: Previous year same month revenue
      prisma.order.aggregate({
        where: {
          paymentStatus: 'PAID',
          createdAt: { gte: prevYearStart, lte: prevYearEnd },
        },
        _sum: { total: true },
      }),
      // #61 Audit: Previous year same month expenses
      prisma.journalLine.aggregate({
        where: {
          account: { type: 'EXPENSE' },
          entry: {
            status: 'POSTED',
            deletedAt: null,
            date: { gte: prevYearStart, lte: prevYearEnd },
          },
        },
        _sum: { debit: true },
      }),
    ]);

    const totalRevenue = Number(revenueAgg._sum.total ?? 0);
    const totalExpenses = Number(expenseAgg._sum.debit ?? 0);
    const bankBalance = bankAccounts.reduce((s, a) => s + Number(a.currentBalance), 0);

    // #61 Audit: Comparison periods
    const prevMonthRevenue = Number(prevMonthRevenueAgg._sum.total ?? 0);
    const prevMonthExpenses = Number(prevMonthExpenseAgg._sum.debit ?? 0);
    const prevYearRevenue = Number(prevYearRevenueAgg._sum.total ?? 0);
    const prevYearExpenses = Number(prevYearExpenseAgg._sum.debit ?? 0);

    const comparisons = {
      monthOverMonth: {
        revenueChange: prevMonthRevenue > 0
          ? Math.round(((totalRevenue - prevMonthRevenue) / prevMonthRevenue) * 10000) / 100
          : null,
        expenseChange: prevMonthExpenses > 0
          ? Math.round(((totalExpenses - prevMonthExpenses) / prevMonthExpenses) * 10000) / 100
          : null,
        prevMonthRevenue,
        prevMonthExpenses,
      },
      yearOverYear: {
        revenueChange: prevYearRevenue > 0
          ? Math.round(((totalRevenue - prevYearRevenue) / prevYearRevenue) * 10000) / 100
          : null,
        expenseChange: prevYearExpenses > 0
          ? Math.round(((totalExpenses - prevYearExpenses) / prevYearExpenses) * 10000) / 100
          : null,
        prevYearRevenue,
        prevYearExpenses,
      },
    };

    // #99 Build the response payload and cache it
    const responseData = {
      totalRevenue,
      totalExpenses,
      pendingInvoices,
      bankBalance,
      comparisons,
      recentEntries: recentEntries.map((e) => ({
        id: e.id,
        entryNumber: e.entryNumber,
        date: e.date,
        description: e.description,
        status: e.status,
        totalDebit: e.lines.reduce((s, l) => s + Number(l.debit), 0),
        totalCredit: e.lines.reduce((s, l) => s + Number(l.credit), 0),
      })),
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        total: Number(o.total),
        status: o.status,
        createdAt: o.createdAt,
      })),
      alerts,
    };

    // #99 Store in cache for subsequent requests
    dashboardCache = {
      data: responseData,
      timestamp: Date.now(),
      monthKey: currentMonthKey,
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du tableau de bord' },
      { status: 500 }
    );
  }
});

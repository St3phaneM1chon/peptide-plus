export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import {
  forecastRevenue,
  generateCashFlowProjection,
  generateCashFlowAlerts,
  runScenarioAnalysis,
  STANDARD_SCENARIOS,
  getForecastMetrics,
} from '@/lib/accounting/forecasting.service';
import { logger } from '@/lib/logger';

/**
 * GET /api/accounting/forecasting
 * Get revenue forecast based on historical data
 * Query params:
 *   - months (number, default: 6) - months ahead to forecast
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const monthsAhead = Math.min(Math.max(1, parseInt(searchParams.get('months') || '6')), 24);

    // Fetch real historical revenue from posted journal entries (last 12 months)
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);

    const monthlyRevenue = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      monthlyRevenue.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 0);
    }

    const revenueLines = await prisma.journalLine.findMany({
      where: {
        entry: { status: 'POSTED', deletedAt: null, date: { gte: twelveMonthsAgo } },
        account: { code: { startsWith: '4' } },
      },
      select: {
        credit: true,
        debit: true,
        entry: { select: { date: true } },
      },
    });

    for (const line of revenueLines) {
      const d = line.entry.date;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyRevenue.has(key)) {
        monthlyRevenue.set(key, (monthlyRevenue.get(key) || 0) + Number(line.credit) - Number(line.debit));
      }
    }

    const historicalRevenue = Array.from(monthlyRevenue.values());

    const forecasts = forecastRevenue(historicalRevenue, monthsAhead);
    const metrics = getForecastMetrics(historicalRevenue);

    // Fetch real financial totals from last fiscal year
    const currentYear = now.getFullYear();
    const yearStart = new Date(currentYear, 0, 1);

    const revenueTotal = await prisma.journalLine.aggregate({
      where: {
        entry: { status: 'POSTED', deletedAt: null, date: { gte: yearStart } },
        account: { code: { startsWith: '4' } },
      },
      _sum: { credit: true, debit: true },
    });

    const expenseTotal = await prisma.journalLine.aggregate({
      where: {
        entry: { status: 'POSTED', deletedAt: null, date: { gte: yearStart } },
        account: { code: { startsWith: '6' } },
      },
      _sum: { debit: true, credit: true },
    });

    const ytdRevenue = Number(revenueTotal._sum.credit || 0) - Number(revenueTotal._sum.debit || 0);
    const ytdExpenses = Number(expenseTotal._sum.debit || 0) - Number(expenseTotal._sum.credit || 0);

    return NextResponse.json({
      forecasts,
      monthsAhead,
      metrics,
      ytdSummary: {
        revenue: ytdRevenue,
        expenses: ytdExpenses,
        netIncome: ytdRevenue - ytdExpenses,
        year: currentYear,
      },
    });
  } catch (error) {
    logger.error('Erreur lors de la génération des prévisions', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la génération des prévisions financières' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/accounting/forecasting
 * Run cash flow projection or scenario analysis
 * Body:
 *   - action: 'cashflow' | 'scenarios'
 *   - currentCashBalance: number
 *   - historicalData: { revenue, purchases, operating, marketing, taxes }
 *   - monthsAhead?: number
 *   - assumptions?: { revenueGrowth, expenseGrowth, taxRate }
 *   - scenarios?: Array<{ name, assumptions }>
 */
export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const { action, currentCashBalance, historicalData, monthsAhead, assumptions, scenarios } = body;

    if (currentCashBalance === undefined || !historicalData) {
      return NextResponse.json(
        { error: 'currentCashBalance et historicalData sont requis' },
        { status: 400 }
      );
    }

    if (action === 'scenarios') {
      const scenarioList = scenarios || STANDARD_SCENARIOS;
      const results = runScenarioAnalysis(currentCashBalance, historicalData, scenarioList);
      return NextResponse.json({ results });
    }

    // Default: cash flow projection
    const projections = generateCashFlowProjection(
      currentCashBalance,
      historicalData,
      monthsAhead || 3,
      assumptions
    );

    const alerts = generateCashFlowAlerts(projections);

    return NextResponse.json({ projections, alerts });
  } catch (error) {
    logger.error('Erreur lors de la projection de trésorerie', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la projection de trésorerie' },
      { status: 500 }
    );
  }
});

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { calculateKPIs, getKPITrend } from '@/lib/accounting/kpi.service';
import type { FinancialKPIs } from '@/lib/accounting/kpi.service';
import { logger } from '@/lib/logger';

/**
 * GET /api/accounting/kpis
 * Calculate and return financial KPIs for a period.
 *
 * Query params:
 *   - startDate (ISO string, default: first day of current month)
 *   - endDate (ISO string, default: today)
 *   - compareWithPrevious (boolean, default: true)
 *   - trend (KPI name, optional) - if set, returns trend data for that KPI
 *   - trendPeriods (number, default: 6)
 */
export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);

    // Parse dates
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const startDate = startDateStr ? new Date(startDateStr) : defaultStart;
    const endDate = endDateStr ? new Date(endDateStr) : now;

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Dates invalides. Format attendu: YYYY-MM-DD' },
        { status: 400 },
      );
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'La date de début doit être antérieure à la date de fin' },
        { status: 400 },
      );
    }

    // Check if trend is requested
    const trendKPI = searchParams.get('trend') as keyof FinancialKPIs | null;
    if (trendKPI) {
      const validKPIs: (keyof FinancialKPIs)[] = [
        'currentRatio', 'quickRatio', 'grossMargin', 'netMargin',
        'dso', 'dpo', 'revenueGrowthPct', 'expenseGrowthPct',
        'cashBalance', 'monthlyBurnRate', 'runwayMonths',
      ];
      if (!validKPIs.includes(trendKPI)) {
        return NextResponse.json(
          { error: `KPI invalide. Valeurs possibles: ${validKPIs.join(', ')}` },
          { status: 400 },
        );
      }
      const periods = parseInt(searchParams.get('trendPeriods') || '6', 10);
      const trend = await getKPITrend(trendKPI, Math.min(periods, 24), endDate);
      return NextResponse.json({ kpi: trendKPI, trend });
    }

    // Calculate current period KPIs
    const kpis = await calculateKPIs(startDate, endDate);

    // Compare with previous period if requested
    const compareWithPrevious = searchParams.get('compareWithPrevious') !== 'false';

    let previousKPIs: FinancialKPIs | null = null;
    if (compareWithPrevious) {
      const durationMs = endDate.getTime() - startDate.getTime();
      const prevEnd = new Date(startDate.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - durationMs);
      previousKPIs = await calculateKPIs(prevStart, prevEnd);
    }

    return NextResponse.json({
      period: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
      kpis,
      ...(previousKPIs ? { previousPeriodKPIs: previousKPIs } : {}),
    });
  } catch (error) {
    logger.error('[KPIs API] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors du calcul des KPIs' },
      { status: 500 },
    );
  }
});

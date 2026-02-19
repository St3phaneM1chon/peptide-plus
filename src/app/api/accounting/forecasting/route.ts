export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  forecastRevenue,
  generateCashFlowProjection,
  generateCashFlowAlerts,
  runScenarioAnalysis,
  STANDARD_SCENARIOS,
  getForecastMetrics,
} from '@/lib/accounting/forecasting.service';

/**
 * GET /api/accounting/forecasting
 * Get revenue forecast based on historical data
 * Query params:
 *   - months (number, default: 6) - months ahead to forecast
 */
export const GET = withAdminGuard(async (request) => {
  const { searchParams } = new URL(request.url);
  const monthsAhead = Math.min(Math.max(1, parseInt(searchParams.get('months') || '6')), 24);

  // For now, use placeholder historical data until real data pipeline is built
  const historicalRevenue = Array(12).fill(0).map((_, i) => 5000 + Math.random() * 2000 + i * 100);

  const forecasts = forecastRevenue(historicalRevenue, monthsAhead);
  const metrics = getForecastMetrics(historicalRevenue);

  return NextResponse.json({ forecasts, monthsAhead, metrics });
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
});

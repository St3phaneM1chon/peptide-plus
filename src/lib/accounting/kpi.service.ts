/**
 * Financial KPI Service
 * Calculate key performance indicators from journal entries and chart of accounts.
 *
 * Phase 10 - Advanced Features
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FinancialKPIs {
  // Liquidity
  currentRatio: number;
  quickRatio: number;

  // Profitability
  grossMargin: number;
  netMargin: number;

  // Efficiency
  dso: number;
  dpo: number;

  // Growth
  revenueGrowthPct: number;
  expenseGrowthPct: number;

  // Cash
  cashBalance: number;
  monthlyBurnRate: number;
  runwayMonths: number;
}

export interface KPITrendPoint {
  date: string;
  value: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPreviousPeriod(startDate: Date, endDate: Date): { prevStart: Date; prevEnd: Date } {
  const durationMs = endDate.getTime() - startDate.getTime();
  const prevEnd = new Date(startDate.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { prevStart, prevEnd };
}

async function sumByAccountType(
  accountType: string,
  startDate?: Date,
  endDate?: Date,
  codePrefix?: string,
): Promise<number> {
  const dateFilter: Prisma.JournalEntryWhereInput = {
    status: 'POSTED',
    deletedAt: null,
    ...(startDate || endDate
      ? {
          date: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {}),
  };

  const accountFilter: Prisma.ChartOfAccountWhereInput = {
    type: accountType as Prisma.EnumAccountTypeFilter['equals'],
    isActive: true,
    ...(codePrefix ? { code: { startsWith: codePrefix } } : {}),
  };

  const result = await prisma.journalLine.aggregate({
    where: {
      entry: dateFilter,
      account: accountFilter,
    },
    _sum: {
      debit: true,
      credit: true,
    },
  });

  const totalDebit = Number(result._sum.debit ?? 0);
  const totalCredit = Number(result._sum.credit ?? 0);

  if (accountType === 'ASSET' || accountType === 'EXPENSE') {
    return totalDebit - totalCredit;
  }
  return totalCredit - totalDebit;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Main KPI Calculation
// ---------------------------------------------------------------------------

export async function calculateKPIs(startDate: Date, endDate: Date): Promise<FinancialKPIs> {
  const periodDays = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
  );

  // Balance sheet items (cumulative up to endDate)
  const currentAssets = await sumByAccountType('ASSET', undefined, endDate, '1');
  const inventoryBalance = await sumByAccountType('ASSET', undefined, endDate, '12');
  const currentLiabilities = await sumByAccountType('LIABILITY', undefined, endDate);
  const cashBalance = await sumByAccountType('ASSET', undefined, endDate, '10');
  const receivables = await sumByAccountType('ASSET', undefined, endDate, '11');
  const payables = await sumByAccountType('LIABILITY', undefined, endDate, '20');

  // Income statement items (within period)
  const revenue = await sumByAccountType('REVENUE', startDate, endDate);
  const cogs = await sumByAccountType('EXPENSE', startDate, endDate, '5');
  const opex = await sumByAccountType('EXPENSE', startDate, endDate, '6');
  const otherNet = await sumByAccountType('EXPENSE', startDate, endDate, '7');

  // Previous period for growth comparison
  const { prevStart, prevEnd } = getPreviousPeriod(startDate, endDate);
  const prevRevenue = await sumByAccountType('REVENUE', prevStart, prevEnd);
  const prevExpenses =
    (await sumByAccountType('EXPENSE', prevStart, prevEnd, '5')) +
    (await sumByAccountType('EXPENSE', prevStart, prevEnd, '6')) +
    (await sumByAccountType('EXPENSE', prevStart, prevEnd, '7'));

  // Compute KPIs
  const totalExpenses = cogs + opex + otherNet;
  const netIncome = revenue - totalExpenses;

  const currentRatio = currentLiabilities !== 0 ? currentAssets / currentLiabilities : 0;
  const quickRatio =
    currentLiabilities !== 0 ? (currentAssets - inventoryBalance) / currentLiabilities : 0;

  const grossMargin = revenue !== 0 ? ((revenue - cogs) / revenue) * 100 : 0;
  const netMargin = revenue !== 0 ? (netIncome / revenue) * 100 : 0;

  const dso = revenue !== 0 ? (receivables / revenue) * 365 : 0;
  const dpo = cogs !== 0 ? (payables / cogs) * 365 : 0;

  const revenueGrowthPct =
    prevRevenue !== 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
  const expenseGrowthPct =
    prevExpenses !== 0 ? ((totalExpenses - prevExpenses) / prevExpenses) * 100 : 0;

  const monthlyBurnRate = periodDays > 0 ? (totalExpenses / periodDays) * 30 : 0;
  const runwayMonths = monthlyBurnRate > 0 ? cashBalance / monthlyBurnRate : 0;

  return {
    currentRatio: round2(currentRatio),
    quickRatio: round2(quickRatio),
    grossMargin: round2(grossMargin),
    netMargin: round2(netMargin),
    dso: round2(dso),
    dpo: round2(dpo),
    revenueGrowthPct: round2(revenueGrowthPct),
    expenseGrowthPct: round2(expenseGrowthPct),
    cashBalance: round2(cashBalance),
    monthlyBurnRate: round2(monthlyBurnRate),
    runwayMonths: round2(runwayMonths),
  };
}

// ---------------------------------------------------------------------------
// KPI Trend
// ---------------------------------------------------------------------------

export async function getKPITrend(
  kpiName: keyof FinancialKPIs,
  periods: number = 6,
  endDate: Date = new Date(),
  periodLengthDays: number = 30,
): Promise<KPITrendPoint[]> {
  const trend: KPITrendPoint[] = [];

  for (let i = periods - 1; i >= 0; i--) {
    const periodEnd = new Date(endDate);
    periodEnd.setDate(periodEnd.getDate() - i * periodLengthDays);
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - periodLengthDays);

    const kpis = await calculateKPIs(periodStart, periodEnd);
    trend.push({
      date: periodEnd.toISOString().split('T')[0],
      value: kpis[kpiName],
    });
  }

  return trend;
}

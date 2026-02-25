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

  try {
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
  } catch (error) {
    console.error('[KPIService] sumByAccountType query failed:', {
      accountType,
      codePrefix,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Consolidated Query Helper
// ---------------------------------------------------------------------------

// F038 FIX: Consolidated KPI queries for performance
// Instead of ~15 sequential sumByAccountType() calls (each a separate DB round-trip),
// we use a single GROUP BY raw query per date range to fetch all account type/prefix
// aggregates at once, then extract individual KPI values from the result in-memory.
// This reduces 15 queries down to 3 (balance sheet + income statement + previous period).

interface AggRow {
  account_type: string;
  code_prefix: string;
  total_debit: number;
  total_credit: number;
}

/**
 * Execute a single GROUP BY query that aggregates journal line totals
 * by account type and 2-character code prefix for a given date range.
 */
async function bulkSumByAccountType(
  startDate?: Date,
  endDate?: Date,
): Promise<AggRow[]> {
  try {
    const dateConditions: string[] = [
      `je.status = 'POSTED'`,
      `je."deletedAt" IS NULL`,
      `ca."isActive" = true`,
    ];
    const params: (Date | string)[] = [];

    if (startDate) {
      params.push(startDate);
      dateConditions.push(`je.date >= $${params.length}::timestamp`);
    }
    if (endDate) {
      params.push(endDate);
      dateConditions.push(`je.date <= $${params.length}::timestamp`);
    }

    const whereClause = dateConditions.join(' AND ');

    const rows = await prisma.$queryRawUnsafe<AggRow[]>(
      `SELECT ca.type AS account_type,
              LEFT(ca.code, 2) AS code_prefix,
              COALESCE(SUM(jl.debit), 0)::float AS total_debit,
              COALESCE(SUM(jl.credit), 0)::float AS total_credit
       FROM "JournalLine" jl
       JOIN "ChartOfAccount" ca ON jl."accountId" = ca.id
       JOIN "JournalEntry" je ON jl."entryId" = je.id
       WHERE ${whereClause}
       GROUP BY ca.type, LEFT(ca.code, 2)`,
      ...params,
    );

    return rows;
  } catch (error) {
    console.error('[KPIService] bulkSumByAccountType query failed:', {
      startDate,
      endDate,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Extract the net balance for a given account type and optional code prefix
 * from pre-aggregated rows. ASSET/EXPENSE = debit - credit; others = credit - debit.
 */
function extractSum(rows: AggRow[], accountType: string, codePrefix?: string): number {
  const filtered = rows.filter((r) => {
    if (r.account_type !== accountType) return false;
    if (codePrefix) return r.code_prefix.startsWith(codePrefix);
    return true;
  });

  let totalDebit = 0;
  let totalCredit = 0;
  for (const r of filtered) {
    totalDebit += r.total_debit;
    totalCredit += r.total_credit;
  }

  if (accountType === 'ASSET' || accountType === 'EXPENSE') {
    return totalDebit - totalCredit;
  }
  return totalCredit - totalDebit;
}

// ---------------------------------------------------------------------------
// Main KPI Calculation
// ---------------------------------------------------------------------------

// F038 FIX: Consolidated KPI queries for performance
// Reduced from ~15 sequential DB queries to 3 bulk GROUP BY queries.
export async function calculateKPIs(startDate: Date, endDate: Date): Promise<FinancialKPIs> {
  try {
  const periodDays = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
  );

  // Previous period dates for growth comparison
  const { prevStart, prevEnd } = getPreviousPeriod(startDate, endDate);

  // F038 FIX: Execute only 3 queries in parallel instead of 15 sequential ones
  const [balanceSheetRows, incomeRows, prevPeriodRows] = await Promise.all([
    // Query 1: Balance sheet (cumulative up to endDate, no startDate)
    bulkSumByAccountType(undefined, endDate),
    // Query 2: Income statement (within current period)
    bulkSumByAccountType(startDate, endDate),
    // Query 3: Previous period (for growth comparison)
    bulkSumByAccountType(prevStart, prevEnd),
  ]);

  // Extract balance sheet items from bulk result
  const currentAssets = extractSum(balanceSheetRows, 'ASSET', '1');
  const inventoryBalance = extractSum(balanceSheetRows, 'ASSET', '12');
  const currentLiabilities = extractSum(balanceSheetRows, 'LIABILITY');
  const cashBalance = extractSum(balanceSheetRows, 'ASSET', '10');
  const receivables = extractSum(balanceSheetRows, 'ASSET', '11');
  const payables = extractSum(balanceSheetRows, 'LIABILITY', '20');

  // Extract income statement items from bulk result
  const revenue = extractSum(incomeRows, 'REVENUE');
  const cogs = extractSum(incomeRows, 'EXPENSE', '5');
  const opex = extractSum(incomeRows, 'EXPENSE', '6');
  const otherNet = extractSum(incomeRows, 'EXPENSE', '7');

  // Extract previous period values from bulk result
  const prevRevenue = extractSum(prevPeriodRows, 'REVENUE');
  const prevExpenses =
    extractSum(prevPeriodRows, 'EXPENSE', '5') +
    extractSum(prevPeriodRows, 'EXPENSE', '6') +
    extractSum(prevPeriodRows, 'EXPENSE', '7');

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
  } catch (error) {
    console.error('[KPIService] Failed to calculate KPIs:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// ---------------------------------------------------------------------------
// KPI Trend
// ---------------------------------------------------------------------------

// A054: Break-even calculation - minimum revenue to cover fixed + variable costs
export interface BreakEvenResult {
  fixedCosts: number;
  variableCosts: number;
  revenue: number;
  contributionMarginRatio: number; // (revenue - variableCosts) / revenue
  breakEvenRevenue: number;       // fixedCosts / contributionMarginRatio
  currentVsBreakEven: number;     // revenue - breakEvenRevenue (positive = profitable)
  safetyMarginPct: number;        // ((revenue - breakEvenRevenue) / revenue) * 100
}

/**
 * A054: Calculate break-even point based on posted journal entries.
 * Fixed costs = accounts 61xx-69xx (rent, salaries, admin, depreciation)
 * Variable costs = accounts 50xx-59xx (COGS, materials, shipping)
 * Revenue = all REVENUE type accounts
 */
export async function calculateBreakEven(
  startDate: Date,
  endDate: Date,
): Promise<BreakEvenResult> {
  const rows = await bulkSumByAccountType(startDate, endDate);

  const revenue = extractSum(rows, 'REVENUE');
  // Variable costs: COGS and direct costs (account codes starting with 5)
  const variableCosts = extractSum(rows, 'EXPENSE', '5');
  // Fixed costs: Operating expenses (account codes starting with 6), plus other (7)
  const fixedCosts = extractSum(rows, 'EXPENSE', '6') + extractSum(rows, 'EXPENSE', '7');

  const contributionMarginRatio = revenue !== 0
    ? (revenue - variableCosts) / revenue
    : 0;

  const breakEvenRevenue = contributionMarginRatio > 0
    ? round2(fixedCosts / contributionMarginRatio)
    : 0;

  const currentVsBreakEven = round2(revenue - breakEvenRevenue);
  const safetyMarginPct = revenue !== 0
    ? round2(((revenue - breakEvenRevenue) / revenue) * 100)
    : 0;

  return {
    fixedCosts: round2(fixedCosts),
    variableCosts: round2(variableCosts),
    revenue: round2(revenue),
    contributionMarginRatio: round2(contributionMarginRatio),
    breakEvenRevenue,
    currentVsBreakEven,
    safetyMarginPct,
  };
}

// ---------------------------------------------------------------------------
// A087: BFR (Besoin en Fonds de Roulement / Working Capital Requirement)
// BFR = Receivables + Inventory - Payables
// A key cash management indicator separate from current/quick ratios.
// ---------------------------------------------------------------------------

export interface WorkingCapitalRequirement {
  receivables: number;         // Accounts receivable (11xx)
  inventory: number;           // Inventory (12xx)
  payables: number;            // Accounts payable (20xx)
  bfr: number;                 // BFR = receivables + inventory - payables
  bfrDays: number;             // BFR expressed in days of revenue
  interpretation: string;      // Human-readable interpretation
}

/**
 * A087: Calculate BFR (Besoin en Fonds de Roulement / Working Capital Requirement).
 * BFR = Stock + Clients - Fournisseurs.
 * A positive BFR means the business needs cash to finance its operating cycle.
 * A negative BFR means the business generates cash from its operating cycle.
 */
export async function calculateWorkingCapitalRequirement(
  startDate: Date,
  endDate: Date,
): Promise<WorkingCapitalRequirement> {
  const rows = await bulkSumByAccountType(undefined, endDate);
  const incomeRows = await bulkSumByAccountType(startDate, endDate);

  const receivables = extractSum(rows, 'ASSET', '11');
  const inventory = extractSum(rows, 'ASSET', '12');
  const payables = extractSum(rows, 'LIABILITY', '20');
  const revenue = extractSum(incomeRows, 'REVENUE');

  const bfr = round2(receivables + inventory - payables);

  // Express BFR in days of revenue for the period
  const periodDays = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const dailyRevenue = revenue / periodDays;
  const bfrDays = dailyRevenue > 0 ? round2(bfr / dailyRevenue) : 0;

  let interpretation: string;
  if (bfr > 0) {
    interpretation = `BFR positif (${bfr.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}): l'entreprise doit financer ${bfrDays} jours de chiffre d'affaires pour son cycle d'exploitation.`;
  } else if (bfr < 0) {
    interpretation = `BFR négatif (${bfr.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}): l'entreprise génère de la trésorerie grâce à son cycle d'exploitation.`;
  } else {
    interpretation = 'BFR nul: le cycle d\'exploitation est auto-financé.';
  }

  return { receivables: round2(receivables), inventory: round2(inventory), payables: round2(payables), bfr, bfrDays, interpretation };
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

    try {
      const kpis = await calculateKPIs(periodStart, periodEnd);
      trend.push({
        date: periodEnd.toISOString().split('T')[0],
        value: kpis[kpiName],
      });
    } catch (error) {
      console.error('[KPIService] Failed to calculate trend for period:', {
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
      // Push zero for failed period instead of crashing the entire trend
      trend.push({
        date: periodEnd.toISOString().split('T')[0],
        value: 0,
      });
    }
  }

  return trend;
}

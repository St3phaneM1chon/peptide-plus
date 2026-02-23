export const dynamic = 'force-dynamic';

/**
 * Admin Budget vs Actual Comparison API
 * GET - Compare budgeted amounts vs actual spending per account
 *
 * Query params:
 *   year  - fiscal year (default: current year)
 *   month - specific month 1-12 (optional; if omitted, returns full year)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { roundCurrency } from '@/lib/financial';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTH_FIELDS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
] as const;

type MonthField = typeof MONTH_FIELDS[number];

/** Get a single month's budgeted amount from a BudgetLine */
function getMonthAmount(line: Record<string, unknown>, month: MonthField): number {
  return Number(line[month] ?? 0);
}

/** Sum budgeted amounts for a range of months (0-indexed start, exclusive end) */
function sumMonths(line: Record<string, unknown>, startMonth: number, endMonth: number): number {
  let total = 0;
  for (let i = startMonth; i < endMonth; i++) {
    total += getMonthAmount(line, MONTH_FIELDS[i]);
  }
  return total;
}

// ---------------------------------------------------------------------------
// GET /api/admin/accounting/budget-comparison
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);

    const now = new Date();
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);
    const monthParam = searchParams.get('month');
    const month = monthParam ? Math.max(1, Math.min(12, parseInt(monthParam, 10))) : null;

    // ------ Find active budget for the year ------
    const budget = await prisma.budget.findFirst({
      where: { year, isActive: true },
      include: {
        lines: {
          orderBy: { accountCode: 'asc' },
        },
      },
    });

    if (!budget) {
      return NextResponse.json({
        year,
        month,
        budget: null,
        message: `Aucun budget actif trouve pour l'annee ${year}`,
        comparison: [],
        totals: {
          budgeted: 0,
          actual: 0,
          variance: 0,
          variancePercent: 0,
        },
      });
    }

    // ------ Determine date range for actual amounts ------
    let periodStart: Date;
    let periodEnd: Date;
    let periodLabel: string;

    if (month) {
      periodStart = new Date(year, month - 1, 1);
      periodEnd = new Date(year, month, 0, 23, 59, 59, 999);
      periodLabel = `${MONTH_FIELDS[month - 1].charAt(0).toUpperCase() + MONTH_FIELDS[month - 1].slice(1)} ${year}`;
    } else {
      periodStart = new Date(year, 0, 1);
      periodEnd = new Date(year, 11, 31, 23, 59, 59, 999);
      periodLabel = `Annee ${year}`;
    }

    // ------ Get actual amounts from journal entries ------
    // Aggregate debits and credits per account code for expense/revenue accounts
    const actualLines = await prisma.journalLine.findMany({
      where: {
        entry: {
          status: 'POSTED',
          date: { gte: periodStart, lte: periodEnd },
        },
      },
      include: {
        account: { select: { code: true, name: true, type: true, normalBalance: true } },
      },
      take: 1000,
    });

    // Aggregate actual amounts by account code
    const actualByCode = new Map<string, {
      name: string;
      type: string;
      normalBalance: string;
      totalDebit: number;
      totalCredit: number;
    }>();

    for (const line of actualLines) {
      const code = line.account.code;
      if (!actualByCode.has(code)) {
        actualByCode.set(code, {
          name: line.account.name,
          type: line.account.type,
          normalBalance: line.account.normalBalance,
          totalDebit: 0,
          totalCredit: 0,
        });
      }
      const acc = actualByCode.get(code)!;
      acc.totalDebit += Number(line.debit);
      acc.totalCredit += Number(line.credit);
    }

    // ------ Build comparison rows ------
    let totalBudgeted = 0;
    let totalActual = 0;

    const comparison = budget.lines.map((budgetLine) => {
      // Budget amount for the period
      let budgeted: number;
      if (month) {
        budgeted = getMonthAmount(budgetLine as unknown as Record<string, unknown>, MONTH_FIELDS[month - 1]);
      } else {
        budgeted = sumMonths(budgetLine as unknown as Record<string, unknown>, 0, 12);
      }
      budgeted = roundCurrency(budgeted);

      // Actual amount for matching account code
      const actualData = actualByCode.get(budgetLine.accountCode);
      let actual = 0;
      if (actualData) {
        // For EXPENSE: actual = debit - credit; for REVENUE: actual = credit - debit
        if (budgetLine.type === 'EXPENSE' || actualData.normalBalance === 'DEBIT') {
          actual = actualData.totalDebit - actualData.totalCredit;
        } else {
          actual = actualData.totalCredit - actualData.totalDebit;
        }
      }
      actual = roundCurrency(actual);

      const variance = roundCurrency(budgeted - actual);
      const variancePercent = budgeted !== 0
        ? roundCurrency((variance / budgeted) * 100)
        : actual === 0 ? 0 : -100;

      totalBudgeted += budgeted;
      totalActual += actual;

      return {
        accountCode: budgetLine.accountCode,
        accountName: budgetLine.accountName,
        type: budgetLine.type,
        budgeted,
        actual,
        variance,
        variancePercent,
        status: variance >= 0 ? 'UNDER_BUDGET' : 'OVER_BUDGET',
      };
    });

    totalBudgeted = roundCurrency(totalBudgeted);
    totalActual = roundCurrency(totalActual);
    const totalVariance = roundCurrency(totalBudgeted - totalActual);
    const totalVariancePercent = totalBudgeted !== 0
      ? roundCurrency((totalVariance / totalBudgeted) * 100)
      : 0;

    return NextResponse.json({
      year,
      month,
      period: periodLabel,
      budget: {
        id: budget.id,
        name: budget.name,
      },
      comparison,
      totals: {
        budgeted: totalBudgeted,
        actual: totalActual,
        variance: totalVariance,
        variancePercent: totalVariancePercent,
      },
    });
  } catch (error) {
    logger.error('Budget comparison error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la comparaison budget vs reel' },
      { status: 500 }
    );
  }
});

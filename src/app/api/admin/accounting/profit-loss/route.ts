export const dynamic = 'force-dynamic';

/**
 * Admin Profit & Loss (Income Statement) by Period
 * GET - Revenue minus expenses grouped by month for a date range
 *
 * Query params:
 *   from  - start date (YYYY-MM-DD), defaults to start of current fiscal year
 *   to    - end date   (YYYY-MM-DD), defaults to today
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { roundCurrency } from '@/lib/financial';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return isNaN(d.getTime()) ? fallback : d;
}

/** Build a YYYY-MM key from a Date */
function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Friendly month label */
function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const months = [
    'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
  ];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

/** Generate all month keys between two dates (inclusive) */
function generateMonthKeys(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= endMonth) {
    keys.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

interface MonthBucket {
  revenue: number;
  expenses: number;
  netIncome: number;
  revenueByAccount: Record<string, { code: string; name: string; amount: number }>;
  expensesByAccount: Record<string, { code: string; name: string; amount: number }>;
}

// ---------------------------------------------------------------------------
// GET /api/admin/accounting/profit-loss
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startDate = parseDate(searchParams.get('from'), startOfYear);
    const endDate = parseDate(searchParams.get('to'), now);

    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    // ------ Fetch all posted journal lines for REVENUE & EXPENSE accounts ------
    const lines = await prisma.journalLine.findMany({
      where: {
        account: { type: { in: ['REVENUE', 'EXPENSE'] } },
        entry: {
          status: 'POSTED',
          date: { gte: startDate, lte: endOfDay },
        },
      },
      include: {
        account: { select: { code: true, name: true, type: true, normalBalance: true } },
        entry: { select: { date: true } },
      },
    });

    // ------ Bucket lines by month ------
    const allMonths = generateMonthKeys(startDate, endDate);
    const buckets = new Map<string, MonthBucket>();

    // Initialize all months
    for (const mk of allMonths) {
      buckets.set(mk, {
        revenue: 0,
        expenses: 0,
        netIncome: 0,
        revenueByAccount: {},
        expensesByAccount: {},
      });
    }

    for (const line of lines) {
      const mk = monthKey(line.entry.date);
      const bucket = buckets.get(mk);
      if (!bucket) continue; // outside range

      const debit = Number(line.debit);
      const credit = Number(line.credit);
      const code = line.account.code;
      const name = line.account.name;

      if (line.account.type === 'REVENUE') {
        // Revenue normal balance is CREDIT
        const amount = credit - debit;
        bucket.revenue += amount;

        if (!bucket.revenueByAccount[code]) {
          bucket.revenueByAccount[code] = { code, name, amount: 0 };
        }
        bucket.revenueByAccount[code].amount += amount;
      } else {
        // Expense normal balance is DEBIT
        const amount = debit - credit;
        bucket.expenses += amount;

        if (!bucket.expensesByAccount[code]) {
          bucket.expensesByAccount[code] = { code, name, amount: 0 };
        }
        bucket.expensesByAccount[code].amount += amount;
      }
    }

    // ------ Build monthly breakdown ------
    let totalRevenue = 0;
    let totalExpenses = 0;

    const monthly = allMonths.map((mk) => {
      const bucket = buckets.get(mk)!;
      const revenue = roundCurrency(bucket.revenue);
      const expenses = roundCurrency(bucket.expenses);
      const netIncome = roundCurrency(revenue - expenses);

      totalRevenue += revenue;
      totalExpenses += expenses;

      return {
        period: mk,
        label: monthLabel(mk),
        revenue,
        expenses,
        netIncome,
        margin: revenue > 0 ? roundCurrency((netIncome / revenue) * 100) : 0,
        revenueBreakdown: Object.values(bucket.revenueByAccount).map((a) => ({
          ...a,
          amount: roundCurrency(a.amount),
        })),
        expensesBreakdown: Object.values(bucket.expensesByAccount).map((a) => ({
          ...a,
          amount: roundCurrency(a.amount),
        })),
      };
    });

    totalRevenue = roundCurrency(totalRevenue);
    totalExpenses = roundCurrency(totalExpenses);
    const totalNetIncome = roundCurrency(totalRevenue - totalExpenses);

    return NextResponse.json({
      period: {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0],
      },
      monthly,
      totals: {
        revenue: totalRevenue,
        expenses: totalExpenses,
        netIncome: totalNetIncome,
        margin: totalRevenue > 0 ? roundCurrency((totalNetIncome / totalRevenue) * 100) : 0,
      },
    });
  } catch (error) {
    console.error('Profit & Loss error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la generation de l\'etat des resultats' },
      { status: 500 }
    );
  }
});

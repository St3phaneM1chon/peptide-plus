export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// GET /api/accounting/income-statement
// Revenue minus Expenses for a given period.
// Query params:
//   - from (ISO date string, required) — period start
//   - to   (ISO date string, required) — period end
// ---------------------------------------------------------------------------
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    if (!fromParam || !toParam) {
      return NextResponse.json(
        { error: 'Les paramètres "from" et "to" sont requis' },
        { status: 400 }
      );
    }

    const fromDate = new Date(fromParam);
    const toDate = new Date(toParam);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: 'Format de date invalide pour "from" ou "to". Utilisez le format ISO (YYYY-MM-DD)' },
        { status: 400 }
      );
    }
    if (fromDate > toDate) {
      return NextResponse.json(
        { error: 'La date "from" doit être antérieure à la date "to"' },
        { status: 400 }
      );
    }

    // Fetch all REVENUE and EXPENSE accounts
    const accounts = await prisma.chartOfAccount.findMany({
      where: { type: { in: ['REVENUE', 'EXPENSE'] }, isActive: true },
      orderBy: { code: 'asc' },
    });
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    // Aggregate journal lines for these accounts within the period
    const aggregations = await prisma.journalLine.groupBy({
      by: ['accountId'],
      _sum: { debit: true, credit: true },
      where: {
        accountId: { in: accounts.map((a) => a.id) },
        entry: {
          date: { gte: fromDate, lte: toDate },
          status: 'POSTED',
        },
      },
    });

    // Build revenue and expense sections
    const revenueLines: Array<{
      accountCode: string;
      accountName: string;
      amount: number;
    }> = [];
    const expenseLines: Array<{
      accountCode: string;
      accountName: string;
      amount: number;
    }> = [];

    for (const agg of aggregations) {
      const account = accountMap.get(agg.accountId);
      if (!account) continue;

      const totalDebit = Number(agg._sum.debit ?? 0);
      const totalCredit = Number(agg._sum.credit ?? 0);

      // Revenue accounts have a normal CREDIT balance: amount = credit - debit
      // Expense accounts have a normal DEBIT balance: amount = debit - credit
      if (account.type === 'REVENUE') {
        const amount = totalCredit - totalDebit;
        revenueLines.push({
          accountCode: account.code,
          accountName: account.name,
          amount: Math.round(amount * 100) / 100,
        });
      } else if (account.type === 'EXPENSE') {
        const amount = totalDebit - totalCredit;
        expenseLines.push({
          accountCode: account.code,
          accountName: account.name,
          amount: Math.round(amount * 100) / 100,
        });
      }
    }

    const totalRevenue = revenueLines.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = expenseLines.reduce((s, r) => s + r.amount, 0);
    const netIncome = totalRevenue - totalExpenses;

    return NextResponse.json({
      period: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0],
      },
      revenue: {
        lines: revenueLines,
        total: Math.round(totalRevenue * 100) / 100,
      },
      expenses: {
        lines: expenseLines,
        total: Math.round(totalExpenses * 100) / 100,
      },
      netIncome: Math.round(netIncome * 100) / 100,
    });
  } catch (error) {
    logger.error('Income statement error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la génération de l\'état des résultats' },
      { status: 500 }
    );
  }
});

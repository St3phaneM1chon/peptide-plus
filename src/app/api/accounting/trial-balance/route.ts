export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// GET /api/accounting/trial-balance
// Sums all debits and credits per account from posted journal entries.
// Query params:
//   - asOfDate (ISO string, default: now) — include entries up to this date
// ---------------------------------------------------------------------------
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const asOfDateParam = searchParams.get('asOfDate');
    if (asOfDateParam) {
      const parsed = new Date(asOfDateParam);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: 'Format de date invalide pour asOfDate. Utilisez le format ISO (YYYY-MM-DD)' },
          { status: 400 }
        );
      }
    }
    const asOfDate = asOfDateParam ? new Date(asOfDateParam) : new Date();

    // Aggregate debits/credits per account for all POSTED entries up to asOfDate
    const aggregations = await prisma.journalLine.groupBy({
      by: ['accountId'],
      _sum: { debit: true, credit: true },
      where: {
        entry: {
          date: { lte: asOfDate },
          status: 'POSTED',
        },
      },
    });

    // Fetch all chart-of-account details for mapping
    const accounts = await prisma.chartOfAccount.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    // Build trial balance rows
    const trialBalance = aggregations
      .map((agg) => {
        const account = accountMap.get(agg.accountId);
        const totalDebit = Number(agg._sum.debit ?? 0);
        const totalCredit = Number(agg._sum.credit ?? 0);
        const balance = totalDebit - totalCredit;

        return {
          accountId: agg.accountId,
          accountCode: account?.code ?? 'N/A',
          accountName: account?.name ?? 'Compte inconnu',
          accountType: account?.type ?? 'UNKNOWN',
          normalBalance: account?.normalBalance ?? 'DEBIT',
          totalDebit,
          totalCredit,
          balance,
        };
      })
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    // Totals
    const totalDebits = trialBalance.reduce((s, r) => s + r.totalDebit, 0);
    const totalCredits = trialBalance.reduce((s, r) => s + r.totalCredit, 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    return NextResponse.json({
      data: trialBalance,
      totals: {
        totalDebits: Math.round(totalDebits * 100) / 100,
        totalCredits: Math.round(totalCredits * 100) / 100,
        difference: Math.round((totalDebits - totalCredits) * 100) / 100,
        isBalanced,
      },
      asOfDate: asOfDate.toISOString(),
    });
  } catch (error) {
    console.error('Trial balance error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération de la balance de vérification' },
      { status: 500 }
    );
  }
});

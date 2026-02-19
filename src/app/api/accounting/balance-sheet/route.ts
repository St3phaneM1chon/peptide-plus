export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// GET /api/accounting/balance-sheet
// Assets = Liabilities + Equity at a point in time.
// Also includes current-period net income rolled into equity.
// Query params:
//   - asOfDate (ISO date string, default: now) — snapshot date
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

    // Fetch all balance-sheet accounts (ASSET, LIABILITY, EQUITY)
    // plus income/expense for retained-earnings calculation
    const accounts = await prisma.chartOfAccount.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    // Aggregate all journal lines for POSTED entries up to asOfDate
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

    // Build sections
    interface BalanceSheetLine {
      accountCode: string;
      accountName: string;
      balance: number;
    }

    const assetLines: BalanceSheetLine[] = [];
    const liabilityLines: BalanceSheetLine[] = [];
    const equityLines: BalanceSheetLine[] = [];
    let retainedEarnings = 0; // Net of revenue - expenses (auto-calculated)

    for (const agg of aggregations) {
      const account = accountMap.get(agg.accountId);
      if (!account) continue;

      const totalDebit = Number(agg._sum.debit ?? 0);
      const totalCredit = Number(agg._sum.credit ?? 0);

      switch (account.type) {
        case 'ASSET': {
          // Assets have normal DEBIT balance
          const balance = totalDebit - totalCredit;
          assetLines.push({
            accountCode: account.code,
            accountName: account.name,
            balance: Math.round(balance * 100) / 100,
          });
          break;
        }
        case 'LIABILITY': {
          // Liabilities have normal CREDIT balance
          const balance = totalCredit - totalDebit;
          liabilityLines.push({
            accountCode: account.code,
            accountName: account.name,
            balance: Math.round(balance * 100) / 100,
          });
          break;
        }
        case 'EQUITY': {
          // Equity has normal CREDIT balance
          const balance = totalCredit - totalDebit;
          equityLines.push({
            accountCode: account.code,
            accountName: account.name,
            balance: Math.round(balance * 100) / 100,
          });
          break;
        }
        case 'REVENUE': {
          // Revenue increases equity (credit normal)
          retainedEarnings += totalCredit - totalDebit;
          break;
        }
        case 'EXPENSE': {
          // Expenses decrease equity (debit normal)
          retainedEarnings -= totalDebit - totalCredit;
          break;
        }
      }
    }

    retainedEarnings = Math.round(retainedEarnings * 100) / 100;

    const totalAssets = Math.round(
      assetLines.reduce((s, r) => s + r.balance, 0) * 100
    ) / 100;
    const totalLiabilities = Math.round(
      liabilityLines.reduce((s, r) => s + r.balance, 0) * 100
    ) / 100;
    const totalEquity = Math.round(
      (equityLines.reduce((s, r) => s + r.balance, 0) + retainedEarnings) * 100
    ) / 100;
    const isBalanced = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01;

    return NextResponse.json({
      asOfDate: asOfDate.toISOString().split('T')[0],
      assets: {
        lines: assetLines,
        total: totalAssets,
      },
      liabilities: {
        lines: liabilityLines,
        total: totalLiabilities,
      },
      equity: {
        lines: equityLines,
        retainedEarnings,
        total: totalEquity,
      },
      isBalanced,
      // The accounting equation: Assets = Liabilities + Equity
      equation: {
        assets: totalAssets,
        liabilitiesPlusEquity: Math.round((totalLiabilities + totalEquity) * 100) / 100,
        difference: Math.round((totalAssets - totalLiabilities - totalEquity) * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Balance sheet error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la génération du bilan' },
      { status: 500 }
    );
  }
});

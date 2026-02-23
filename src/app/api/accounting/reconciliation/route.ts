export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import {
  autoReconcile,
  parseBankStatementCSV,
  getReconciliationSummary,
} from '@/lib/accounting';
import { logger } from '@/lib/logger';

/**
 * POST /api/accounting/reconciliation
 * Run auto-reconciliation
 */
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const reconciliationStartTime = Date.now();

    const body = await request.json();
    const { bankAccountId, criteria } = body;

    // #77 Audit: Paginate pending transactions to avoid loading all at once
    // FIX: F058 - Uses batch size limit (not full pagination). TODO: implement cursor-based
    // pagination for datasets exceeding maxBatchSize to process all pending transactions.
    const maxBatchSize = 500;
    const where: Record<string, unknown> = { reconciliationStatus: 'PENDING', deletedAt: null };
    if (bankAccountId) where.bankAccountId = bankAccountId;

    const dbTransactions = await prisma.bankTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
      take: maxBatchSize, // Process in batches to control memory usage
    });

    const bankTransactions = dbTransactions.map((t) => ({
      id: t.id,
      bankAccountId: t.bankAccountId,
      date: t.date,
      description: t.description,
      amount: Number(t.amount),
      type: t.type as 'CREDIT' | 'DEBIT',
      reconciliationStatus: t.reconciliationStatus,
      importedAt: t.importedAt,
    }));

    // Fetch posted journal entries for matching
    const dbEntries = await prisma.journalEntry.findMany({
      where: { status: 'POSTED', deletedAt: null },
      include: {
        lines: {
          include: { account: { select: { code: true, name: true } } },
        },
      },
      orderBy: { date: 'desc' },
      // Fetch enough entries to cover reconciliation matching across a wide period
      take: 1000,
    });

    const journalEntries = dbEntries.map((e) => ({
      id: e.id,
      entryNumber: e.entryNumber,
      date: e.date,
      description: e.description,
      type: e.type,
      status: e.status,
      reference: e.reference || undefined,
      lines: e.lines.map((l) => ({
        id: l.id,
        accountCode: l.account.code,
        accountName: l.account.name,
        debit: Number(l.debit),
        credit: Number(l.credit),
      })),
      createdBy: e.createdBy,
      createdAt: e.createdAt,
      postedAt: e.postedAt || undefined,
    }));

    const result = autoReconcile(bankTransactions, journalEntries, criteria);

    // #84 Error Recovery: Track matched IDs from result.suggestions directly,
    // don't rely on mutated in-memory state which may be inconsistent after autoReconcile
    const matchedIds = result.suggestions
      .filter((s) => s.confidence >= (criteria?.minConfidenceScore || 0.7))
      .map((s) => s.bankTransactionId);
    // Also include IDs from bankTransactions that autoReconcile mutated to MATCHED
    const mutatedMatchedIds = bankTransactions
      .filter((t) => t.reconciliationStatus === 'MATCHED')
      .map((t) => t.id);
    // Merge both sets of matched IDs (deduplicated)
    const allMatchedIds = [...new Set([...matchedIds, ...mutatedMatchedIds])];
    if (allMatchedIds.length > 0) {
      await prisma.bankTransaction.updateMany({
        where: { id: { in: allMatchedIds } },
        data: {
          reconciliationStatus: 'MATCHED',
          matchedAt: new Date(),
          matchedBy: session.user.id || session.user.email,
        },
      });
    }

    const reconciliationDuration = Date.now() - reconciliationStartTime;
    logger.info('Reconciliation completed:', {
      bankAccountId: bankAccountId || 'all',
      matched: result.matched,
      unmatched: result.unmatched,
      durationMs: reconciliationDuration,
      initiatedBy: session.user.id || session.user.email,
    });

    return NextResponse.json({
      success: true,
      result: {
        matched: result.matched,
        unmatched: result.unmatched,
        suggestions: result.suggestions,
        durationMs: reconciliationDuration,
      },
    });
  } catch (error) {
    logger.error('Reconciliation error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors du rapprochement' },
      { status: 500 }
    );
  }
});

/**
 * GET /api/accounting/reconciliation
 * Get reconciliation summary
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const bankAccountId = searchParams.get('bankAccountId');

    // Fetch from DB
    const where: Record<string, unknown> = { deletedAt: null };
    if (bankAccountId) where.bankAccountId = bankAccountId;

    const dbTransactions = await prisma.bankTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 100,
    });

    const bankTransactions = dbTransactions.map((t) => ({
      id: t.id,
      bankAccountId: t.bankAccountId,
      date: t.date,
      description: t.description,
      amount: Number(t.amount),
      type: t.type as 'CREDIT' | 'DEBIT',
      reconciliationStatus: t.reconciliationStatus,
      importedAt: t.importedAt,
    }));

    // Get bank account balance (statement balance)
    const bankAccount = bankAccountId
      ? await prisma.bankAccount.findUnique({
          where: { id: bankAccountId },
          select: { currentBalance: true, chartAccountId: true },
        })
      : null;
    const bankBalance = bankAccount ? Number(bankAccount.currentBalance) : 0;

    // Calculate actual book balance from posted journal entries for this bank account.
    // The book balance is the sum of (debits - credits) for the linked chart-of-account
    // in all POSTED journal entries. This gives the real GL balance, not just a copy
    // of the bank statement balance.
    let bookBalance = 0;
    if (bankAccount?.chartAccountId) {
      const glAgg = await prisma.journalLine.aggregate({
        where: {
          accountId: bankAccount.chartAccountId,
          entry: { status: 'POSTED', deletedAt: null },
        },
        _sum: {
          debit: true,
          credit: true,
        },
      });
      const totalDebits = Number(glAgg._sum.debit ?? 0);
      const totalCredits = Number(glAgg._sum.credit ?? 0);
      // Bank accounts (assets) have a normal DEBIT balance
      bookBalance = Math.round((totalDebits - totalCredits) * 100) / 100;
    } else if (bankAccountId) {
      // FIX: F059 - Fallback COA codes are hardcoded. Validate that these codes actually
      // exist in the DB before aggregating. If none exist, bookBalance stays 0 (safe default).
      const bankChartAccounts = await prisma.chartOfAccount.findMany({
        where: { code: { in: ['1010', '1020', '1030', '1040'] }, isActive: true },
        select: { id: true },
      });
      if (bankChartAccounts.length > 0) {
        const glAgg = await prisma.journalLine.aggregate({
          where: {
            accountId: { in: bankChartAccounts.map(a => a.id) },
            entry: { status: 'POSTED', deletedAt: null },
          },
          _sum: {
            debit: true,
            credit: true,
          },
        });
        const totalDebits = Number(glAgg._sum.debit ?? 0);
        const totalCredits = Number(glAgg._sum.credit ?? 0);
        bookBalance = Math.round((totalDebits - totalCredits) * 100) / 100;
      }
    }

    const summary = getReconciliationSummary(
      bankTransactions,
      bankBalance,
      bookBalance
    );

    // Include unmatched items detail so the frontend can display discrepancies
    const unmatchedBankItems = bankTransactions.filter(
      (t) => t.reconciliationStatus === 'PENDING' || t.reconciliationStatus === 'UNMATCHED'
    );

    return NextResponse.json({
      summary,
      transactions: bankTransactions,
      analysis: {
        bankBalance,
        bookBalance,
        difference: Math.round((bankBalance - bookBalance) * 100) / 100,
        unmatchedBankItems: unmatchedBankItems.length,
        possibleCauses: bankBalance !== bookBalance ? [
          bankBalance > bookBalance
            ? 'Transactions bancaires non enregistrées dans le journal (dépôts en transit, frais bancaires manquants)'
            : 'Écritures comptables sans transaction bancaire correspondante (chèques en circulation, virements en attente)',
          'Erreurs de saisie ou montants divergents',
          'Transactions en double dans le journal ou le relevé',
        ] : [],
      },
    });
  } catch (error) {
    logger.error('Get reconciliation error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du rapprochement' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/accounting/reconciliation
 * Import bank statement
 *
 * FIX (F022): NOTE - PUT is semantically wrong for importing data (should be POST).
 * PUT implies idempotent full replacement of a resource, not an additive import.
 * TODO: Create a dedicated POST /api/accounting/bank-import route and deprecate this.
 * Keeping PUT for backward compatibility with existing frontend calls.
 */
export const PUT = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const { csvContent, bankAccountId, format } = body;

    if (csvContent && csvContent.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'CSV too large' }, { status: 413 });
    }

    if (!csvContent || !bankAccountId) {
      return NextResponse.json(
        { error: 'csvContent et bankAccountId sont requis' },
        { status: 400 }
      );
    }

    const transactions = parseBankStatementCSV(
      csvContent,
      bankAccountId,
      format || 'generic'
    );

    // Save to database using createMany for batch efficiency
    const importBatch = `import-${Date.now()}`;
    await prisma.bankTransaction.createMany({
      data: transactions.map((t) => ({
        bankAccountId,
        date: t.date,
        description: t.description,
        amount: t.amount,
        type: t.type,
        reconciliationStatus: 'PENDING',
        importBatch,
        rawData: JSON.stringify(t),
      })),
    });

    return NextResponse.json({
      success: true,
      imported: transactions.length,
      importBatch,
    });
  } catch (error) {
    logger.error('Import statement error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de l\'import du relevé' },
      { status: 500 }
    );
  }
});

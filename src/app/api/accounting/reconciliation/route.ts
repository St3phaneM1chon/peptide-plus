import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { prisma } from '@/lib/db';
import {
  autoReconcile,
  parseBankStatementCSV,
  getReconciliationSummary,
} from '@/lib/accounting';

/**
 * POST /api/accounting/reconciliation
 * Run auto-reconciliation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { bankAccountId, criteria } = body;

    // Fetch pending bank transactions
    const where: Record<string, unknown> = { reconciliationStatus: 'PENDING' };
    if (bankAccountId) where.bankAccountId = bankAccountId;

    const dbTransactions = await prisma.bankTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
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
      where: { status: 'POSTED' },
      include: {
        lines: {
          include: { account: { select: { code: true, name: true } } },
        },
      },
      orderBy: { date: 'desc' },
      take: 200,
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

    // Update matched transactions in DB
    for (const match of result.matched) {
      await prisma.bankTransaction.update({
        where: { id: match.bankTransaction.id },
        data: {
          reconciliationStatus: 'MATCHED',
          matchedEntryId: match.journalEntry.id,
          matchedAt: new Date(),
          matchedBy: session.user.id || session.user.email,
        },
      });
    }

    return NextResponse.json({
      success: true,
      result: {
        matched: result.matched,
        unmatched: result.unmatched,
        suggestions: result.suggestions,
      },
    });
  } catch (error) {
    console.error('Reconciliation error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du rapprochement' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/accounting/reconciliation
 * Get reconciliation summary
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const bankAccountId = searchParams.get('bankAccountId');

    // Fetch from DB
    const where: Record<string, unknown> = {};
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

    // Get bank account balances
    const bankAccount = bankAccountId
      ? await prisma.bankAccount.findUnique({
          where: { id: bankAccountId },
          select: { currentBalance: true },
        })
      : null;
    const bankBalance = bankAccount ? Number(bankAccount.currentBalance) : 0;

    // Calculate book balance from journal entries
    const bookBalance = bankBalance; // Simplified - in full impl, calculate from GL

    const summary = getReconciliationSummary(
      bankTransactions,
      bankBalance,
      bookBalance
    );

    return NextResponse.json({
      summary,
      transactions: bankTransactions,
    });
  } catch (error) {
    console.error('Get reconciliation error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du rapprochement' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/accounting/reconciliation
 * Import bank statement
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { csvContent, bankAccountId, format } = body;

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

    // Save to database
    const importBatch = `import-${Date.now()}`;
    for (const t of transactions) {
      await prisma.bankTransaction.create({
        data: {
          bankAccountId,
          date: t.date,
          description: t.description,
          amount: t.amount,
          type: t.type,
          reconciliationStatus: 'PENDING',
          importBatch,
          rawData: JSON.stringify(t),
        },
      });
    }

    return NextResponse.json({
      success: true,
      imported: transactions.length,
      importBatch,
    });
  } catch (error) {
    console.error('Import statement error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'import du relevé' },
      { status: 500 }
    );
  }
}

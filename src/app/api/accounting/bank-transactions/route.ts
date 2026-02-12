import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/accounting/bank-transactions
 * List bank transactions with filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bankAccountId = searchParams.get('bankAccountId');
    const reconciliationStatus = searchParams.get('reconciliationStatus');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {};
    if (bankAccountId) where.bankAccountId = bankAccountId;
    if (reconciliationStatus) where.reconciliationStatus = reconciliationStatus;
    if (from || to) {
      where.date = {};
      if (from) (where.date as Record<string, unknown>).gte = new Date(from);
      if (to) (where.date as Record<string, unknown>).lte = new Date(to);
    }

    const [transactions, total] = await Promise.all([
      prisma.bankTransaction.findMany({
        where,
        include: { bankAccount: { select: { name: true, institution: true } } },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bankTransaction.count({ where }),
    ]);

    const mapped = transactions.map((t) => ({
      ...t,
      amount: Number(t.amount),
    }));

    return NextResponse.json({
      transactions: mapped,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get bank transactions error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des transactions bancaires' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/bank-transactions
 * Import bank transactions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bankAccountId, transactions } = body;

    if (!bankAccountId || !transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: 'bankAccountId et un tableau de transactions sont requis' },
        { status: 400 }
      );
    }

    const bankAccount = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
    if (!bankAccount) {
      return NextResponse.json({ error: 'Compte bancaire non trouvé' }, { status: 404 });
    }

    const importBatch = `IMP-${Date.now()}`;

    const created = await prisma.bankTransaction.createMany({
      data: transactions.map((t: { date: string; description: string; amount: number; type: string; reference?: string }) => ({
        bankAccountId,
        date: new Date(t.date),
        description: t.description,
        amount: t.amount,
        type: t.type,
        reference: t.reference || null,
        importBatch,
      })),
    });

    return NextResponse.json({
      success: true,
      imported: created.count,
      importBatch,
    }, { status: 201 });
  } catch (error) {
    console.error('Import transactions error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'import des transactions' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/accounting/bank-transactions
 * Update a bank transaction (match/unmatch reconciliation)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, reconciliationStatus, matchedEntryId } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.bankTransaction.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Transaction bancaire non trouvée' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (reconciliationStatus !== undefined) updateData.reconciliationStatus = reconciliationStatus;
    if (matchedEntryId !== undefined) {
      updateData.matchedEntryId = matchedEntryId;
      updateData.matchedAt = new Date();
    }

    const transaction = await prisma.bankTransaction.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      transaction: { ...transaction, amount: Number(transaction.amount) },
    });
  } catch (error) {
    console.error('Update bank transaction error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la transaction bancaire' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------
const transactionItemSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1),
  amount: z.number(),
  type: z.string().min(1),
  reference: z.string().optional(),
});

const importTransactionsSchema = z.object({
  bankAccountId: z.string().min(1, 'bankAccountId is required'),
  transactions: z.array(transactionItemSchema).min(1, 'At least one transaction is required').max(1000, 'Maximum 1000 transactions per batch'),
});

const updateTransactionSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  reconciliationStatus: z.string().optional(),
  matchedEntryId: z.string().nullable().optional(),
});

/**
 * GET /api/accounting/bank-transactions
 * List bank transactions with filters
 *
 * #85 Audit: Recommended indexes for performance on large datasets:
 *   CREATE INDEX idx_bank_tx_date ON "BankTransaction" ("date" DESC) WHERE "deletedAt" IS NULL;
 *   CREATE INDEX idx_bank_tx_account_date ON "BankTransaction" ("bankAccountId", "date" DESC) WHERE "deletedAt" IS NULL;
 *   CREATE INDEX idx_bank_tx_reconciliation ON "BankTransaction" ("reconciliationStatus", "date" DESC) WHERE "deletedAt" IS NULL;
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const bankAccountId = searchParams.get('bankAccountId');
    const reconciliationStatus = searchParams.get('reconciliationStatus');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 200);

    // Validate date range if provided
    if (from || to) {
      const startDate = from ? new Date(from) : null;
      const endDate = to ? new Date(to) : null;

      if ((from && isNaN(startDate!.getTime())) || (to && isNaN(endDate!.getTime()))) {
        return NextResponse.json({ error: 'Format de date invalide. Utilisez le format ISO (YYYY-MM-DD)' }, { status: 400 });
      }
      if (startDate && endDate && startDate > endDate) {
        return NextResponse.json({ error: 'La date de début doit être antérieure à la date de fin' }, { status: 400 });
      }
      if (startDate && endDate) {
        const oneYearMs = 365 * 24 * 60 * 60 * 1000;
        if (endDate.getTime() - startDate.getTime() > oneYearMs) {
          return NextResponse.json({ error: 'La plage de dates ne peut pas dépasser 1 an' }, { status: 400 });
        }
      }
    }

    const where: Record<string, unknown> = { deletedAt: null };
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
      data: mapped,
      transactions: mapped, // backward-compat alias
      pagination: {
        page,
        pageSize: limit,
        totalCount: total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Get bank transactions error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des transactions bancaires' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/accounting/bank-transactions
 * Import bank transactions
 */
export const POST = withAdminGuard(async (request) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/bank-transactions');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = importTransactionsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { bankAccountId, transactions } = parsed.data;

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
    logger.error('Import transactions error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de l\'import des transactions' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/accounting/bank-transactions
 * Update a bank transaction (match/unmatch reconciliation)
 */
export const PUT = withAdminGuard(async (request) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/bank-transactions');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { id, reconciliationStatus, matchedEntryId } = parsed.data;

    const existing = await prisma.bankTransaction.findFirst({ where: { id, deletedAt: null } });
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
    logger.error('Update bank transaction error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la transaction bancaire' },
      { status: 500 }
    );
  }
});

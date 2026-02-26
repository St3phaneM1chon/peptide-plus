export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import {
  getIntercoTransactions,
  createIntercoTransaction,
  getIntercoBalances,
  type IntercoTransactionStatus,
  type IntercoTransactionType,
} from '@/lib/accounting/multi-entity.service';

/**
 * GET /api/accounting/interco
 * List intercompany transactions with filters.
 * Query params: entityId, status, type, startDate, endDate, page, limit, view
 * view=balances returns interco balances instead of transactions.
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);

    // Special view: interco balances
    if (searchParams.get('view') === 'balances') {
      const balances = await getIntercoBalances();
      return NextResponse.json({ data: balances });
    }

    const entityId = searchParams.get('entityId') || undefined;
    const status = (searchParams.get('status') || undefined) as
      | IntercoTransactionStatus
      | undefined;
    const type = (searchParams.get('type') || undefined) as IntercoTransactionType | undefined;
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(
      Math.max(1, parseInt(searchParams.get('limit') || '50') || 50),
      200,
    );

    const result = await getIntercoTransactions({
      entityId,
      status,
      type,
      startDate,
      endDate,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Get interco transactions error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des transactions intercos' },
      { status: 500 },
    );
  }
});

const createIntercoSchema = z.object({
  fromEntityId: z.string().min(1, 'Entite source requise'),
  toEntityId: z.string().min(1, 'Entite cible requise'),
  type: z.enum([
    'SALE',
    'PURCHASE',
    'LOAN',
    'PAYMENT',
    'EXPENSE_ALLOCATION',
    'MANAGEMENT_FEE',
  ]),
  amount: z.number().positive('Le montant doit etre positif'),
  description: z.string().min(1, 'Description requise').max(500),
});

/**
 * POST /api/accounting/interco
 * Create a new intercompany transaction.
 */
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = createIntercoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const { fromEntityId, toEntityId, type, amount, description } = parsed.data;

    const transaction = await createIntercoTransaction(
      fromEntityId,
      toEntityId,
      type,
      amount,
      description,
      session?.user?.id || session?.user?.email || undefined,
    );

    return NextResponse.json({ success: true, transaction }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);

    if (msg.includes('different entities')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (msg.includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg.includes('must be positive')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    logger.error('Create interco transaction error', { error: msg });
    return NextResponse.json(
      { error: 'Erreur lors de la creation de la transaction interco' },
      { status: 500 },
    );
  }
});

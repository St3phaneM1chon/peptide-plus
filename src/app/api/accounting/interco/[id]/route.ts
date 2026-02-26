export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { updateIntercoTransaction } from '@/lib/accounting/multi-entity.service';

/**
 * GET /api/accounting/interco/[id]
 * Get a single intercompany transaction by ID.
 */
export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const transaction = await prisma.intercompanyTransaction.findUnique({
      where: { id },
      include: {
        fromEntity: { select: { id: true, name: true, code: true } },
        toEntity: { select: { id: true, name: true, code: true } },
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction interco non trouvee' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: { ...transaction, amount: Number(transaction.amount) },
    });
  } catch (error) {
    logger.error('Get interco transaction error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation de la transaction' },
      { status: 500 },
    );
  }
});

const updateIntercoSchema = z.object({
  status: z.enum(['PENDING', 'POSTED', 'ELIMINATED', 'CANCELLED']).optional(),
  description: z.string().min(1).max(500).optional(),
  journalEntryRef: z.string().nullish(),
  matchingRef: z.string().nullish(),
});

/**
 * PUT /api/accounting/interco/[id]
 * Update an intercompany transaction.
 */
export const PUT = withAdminGuard(async (request, { params }) => {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateIntercoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const transaction = await updateIntercoTransaction(id, {
      status: parsed.data.status,
      description: parsed.data.description,
      journalEntryRef: parsed.data.journalEntryRef ?? undefined,
      matchingRef: parsed.data.matchingRef ?? undefined,
    });

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg.includes('Cannot modify')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    logger.error('Update interco transaction error', { error: msg });
    return NextResponse.json(
      { error: 'Erreur lors de la mise a jour de la transaction' },
      { status: 500 },
    );
  }
});

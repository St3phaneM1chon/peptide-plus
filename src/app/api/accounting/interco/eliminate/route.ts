export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { eliminateIntercoTransactions } from '@/lib/accounting/multi-entity.service';

const eliminateSchema = z.object({
  startDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date de debut invalide'),
  endDate: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date de fin invalide'),
});

/**
 * POST /api/accounting/interco/eliminate
 * Eliminate matched intercompany transactions for consolidation.
 */
export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const parsed = eliminateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const startDate = new Date(parsed.data.startDate);
    const endDate = new Date(parsed.data.endDate);

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'La date de debut doit etre anterieure a la date de fin' },
        { status: 400 },
      );
    }

    const result = await eliminateIntercoTransactions(startDate, endDate);

    return NextResponse.json({
      success: true,
      eliminated: result.eliminated,
      totalAmount: result.totalAmount,
      message: result.eliminated > 0
        ? `${result.eliminated} transaction(s) eliminee(s) pour un total de ${result.totalAmount.toFixed(2)} $`
        : 'Aucune transaction a eliminer pour cette periode',
    });
  } catch (error) {
    logger.error('Eliminate interco transactions error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de l\'elimination des transactions intercos' },
      { status: 500 },
    );
  }
});

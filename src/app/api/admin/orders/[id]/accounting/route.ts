export const dynamic = 'force-dynamic';

/**
 * Bridge #3: Commerce → Comptabilité
 * GET /api/admin/orders/[id]/accounting
 *
 * Returns journal entries linked to this order, gated by ff.accounting_module.
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { isModuleEnabled } from '@/lib/module-flags';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    // Gate: accounting module must be enabled
    if (!(await isModuleEnabled('accounting'))) {
      return apiSuccess({ enabled: false }, { request });
    }

    // Verify order exists
    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, orderNumber: true },
    });

    if (!order) {
      return apiError('Order not found', ErrorCode.NOT_FOUND, { request });
    }

    // Fetch journal entries linked to this order
    const entries = await prisma.journalEntry.findMany({
      where: { orderId: id },
      include: {
        lines: {
          include: {
            account: { select: { id: true, code: true, name: true } },
          },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Compute totals
    let totalDebit = 0;
    let totalCredit = 0;
    for (const entry of entries) {
      for (const line of entry.lines) {
        totalDebit += Number(line.debit);
        totalCredit += Number(line.credit);
      }
    }

    const serializedEntries = entries.map((e) => ({
      id: e.id,
      entryNumber: e.entryNumber,
      date: e.date,
      description: e.description,
      type: e.type,
      status: e.status,
      lines: e.lines.map((l) => ({
        id: l.id,
        accountCode: l.account?.code ?? null,
        accountName: l.account?.name ?? null,
        description: l.description,
        debit: Number(l.debit),
        credit: Number(l.credit),
      })),
    }));

    return apiSuccess(
      {
        enabled: true,
        entries: serializedEntries,
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        count: entries.length,
      },
      { request }
    );
  } catch (error) {
    logger.error('[orders/[id]/accounting] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch accounting data', ErrorCode.INTERNAL_ERROR, { request });
  }
});

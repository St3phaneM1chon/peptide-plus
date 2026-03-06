export const dynamic = 'force-dynamic';

/**
 * Bridge #14: Comptabilité → CRM
 * GET /api/admin/accounting/entries/[id]/crm
 *
 * Returns the CRM deal linked to a journal entry (via order → deal).
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
    const enabled = await isModuleEnabled('crm');
    if (!enabled) return apiSuccess({ enabled: false }, { request });

    const { id } = await params;

    const entry = await prisma.journalEntry.findUnique({
      where: { id },
      select: { id: true, orderId: true },
    });
    if (!entry) return apiError('Entry not found', ErrorCode.NOT_FOUND, { request });

    if (!entry.orderId) return apiSuccess({ enabled: true, deal: null }, { request });

    const order = await prisma.order.findUnique({
      where: { id: entry.orderId },
      select: { id: true, orderNumber: true, dealId: true },
    });
    if (!order?.dealId) return apiSuccess({ enabled: true, deal: null, order: order ? { id: order.id, orderNumber: order.orderNumber } : null }, { request });

    const deal = await prisma.crmDeal.findUnique({
      where: { id: order.dealId },
      select: {
        id: true, title: true, value: true, currency: true, createdAt: true,
        stage: { select: { name: true, isWon: true, isLost: true } },
      },
    });

    return apiSuccess({
      enabled: true,
      order: { id: order.id, orderNumber: order.orderNumber },
      deal: deal ? {
        id: deal.id, title: deal.title, value: Number(deal.value), currency: deal.currency,
        stage: deal.stage.name, isWon: deal.stage.isWon, isLost: deal.stage.isLost, date: deal.createdAt,
      } : null,
    }, { request });
  } catch (error) {
    logger.error('[accounting/entries/[id]/crm] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch CRM link', ErrorCode.INTERNAL_ERROR, { request });
  }
});

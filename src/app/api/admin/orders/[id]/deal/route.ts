export const dynamic = 'force-dynamic';

/**
 * Bridge #24: Commerce → CRM (Source Deal)
 * GET /api/admin/orders/[id]/deal
 *
 * Returns the CRM deal that generated this order, gated by ff.crm_module.
 * Requires Order.dealId FK.
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

    if (!(await isModuleEnabled('crm'))) {
      return apiSuccess({ enabled: false }, { request });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        dealId: true,
        deal: {
          select: {
            id: true,
            title: true,
            value: true,
            stage: { select: { name: true } },
          },
        },
      },
    });

    if (!order) {
      return apiError('Order not found', ErrorCode.NOT_FOUND, { request });
    }

    return apiSuccess(
      {
        enabled: true,
        deal: order.deal
          ? {
              id: order.deal.id,
              title: order.deal.title,
              stageName: order.deal.stage.name,
              value: Number(order.deal.value),
            }
          : null,
      },
      { request }
    );
  } catch (error) {
    logger.error('[orders/[id]/deal] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch deal data', ErrorCode.INTERNAL_ERROR, { request });
  }
});

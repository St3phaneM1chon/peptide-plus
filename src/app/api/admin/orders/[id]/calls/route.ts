export const dynamic = 'force-dynamic';

/**
 * Bridge #23: Commerce → Téléphonie
 * GET /api/admin/orders/[id]/calls
 *
 * Returns call history of the order's customer, gated by ff.voip_module.
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

    if (!(await isModuleEnabled('voip'))) {
      return apiSuccess({ enabled: false }, { request });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!order) {
      return apiError('Order not found', ErrorCode.NOT_FOUND, { request });
    }

    if (!order.userId) {
      return apiSuccess({ enabled: true, recentCalls: [], totalCalls: 0, totalDuration: 0 }, { request });
    }

    const [calls, agg] = await Promise.all([
      prisma.callLog.findMany({
        where: { clientId: order.userId },
        take: 5,
        orderBy: { startedAt: 'desc' },
        select: { id: true, direction: true, status: true, duration: true, startedAt: true },
      }),
      prisma.callLog.aggregate({
        where: { clientId: order.userId },
        _count: true,
        _sum: { duration: true },
      }),
    ]);

    return apiSuccess(
      {
        enabled: true,
        recentCalls: calls.map((c) => ({
          id: c.id,
          direction: c.direction,
          status: c.status,
          duration: c.duration ?? 0,
          startedAt: c.startedAt.toISOString(),
        })),
        totalCalls: agg._count,
        totalDuration: agg._sum.duration ?? 0,
      },
      { request }
    );
  } catch (error) {
    logger.error('[orders/[id]/calls] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch call data', ErrorCode.INTERNAL_ERROR, { request });
  }
});

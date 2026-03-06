export const dynamic = 'force-dynamic';

/**
 * Bridge #5: Commerce → Fidélité
 * GET /api/admin/orders/[id]/loyalty
 *
 * Returns loyalty transactions linked to this order, gated by ff.loyalty_module.
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

    // Gate: loyalty module must be enabled
    if (!(await isModuleEnabled('loyalty'))) {
      return apiSuccess({ enabled: false }, { request });
    }

    // Fetch order with user info
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        user: {
          select: { id: true, name: true, loyaltyTier: true, loyaltyPoints: true },
        },
      },
    });

    if (!order) {
      return apiError('Order not found', ErrorCode.NOT_FOUND, { request });
    }

    // Fetch loyalty transactions for this order
    const transactions = await prisma.loyaltyTransaction.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        points: true,
        description: true,
        balanceAfter: true,
        createdAt: true,
      },
    });

    const pointsEarned = transactions
      .filter((tx) => tx.points > 0)
      .reduce((sum, tx) => sum + tx.points, 0);

    const pointsUsed = transactions
      .filter((tx) => tx.points < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.points), 0);

    return apiSuccess(
      {
        enabled: true,
        transactions,
        pointsEarned,
        pointsUsed,
        currentTier: order.user?.loyaltyTier ?? null,
        currentPoints: order.user?.loyaltyPoints ?? 0,
      },
      { request }
    );
  } catch (error) {
    logger.error('[orders/[id]/loyalty] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch loyalty data', ErrorCode.INTERNAL_ERROR, { request });
  }
});

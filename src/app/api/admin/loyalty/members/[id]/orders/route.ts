export const dynamic = 'force-dynamic';

/**
 * Bridge #6: Fidélité → Commerce
 * GET /api/admin/loyalty/members/[id]/orders
 *
 * Returns order history for a loyalty member (userId).
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
    const enabled = await isModuleEnabled('ecommerce');
    if (!enabled) return apiSuccess({ enabled: false }, { request });

    const { id: userId } = await params;

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } });
    if (!user) return apiError('User not found', ErrorCode.NOT_FOUND, { request });

    // Get loyalty transactions with order links
    const [transactions, orders] = await Promise.all([
      prisma.loyaltyTransaction.findMany({
        where: { userId },
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: { id: true, type: true, points: true, description: true, orderId: true, createdAt: true },
      }),
      prisma.order.findMany({
        where: { userId, paymentStatus: 'PAID' },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, orderNumber: true, total: true, status: true, createdAt: true },
      }),
    ]);

    const totalSpent = orders.reduce((s, o) => s + Number(o.total), 0);

    return apiSuccess({
      enabled: true,
      member: user,
      totalSpent: Math.round(totalSpent * 100) / 100,
      orderCount: orders.length,
      recentOrders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        total: Number(o.total),
        status: o.status,
        date: o.createdAt,
      })),
      recentTransactions: transactions,
    }, { request });
  } catch (error) {
    logger.error('[loyalty/members/[id]/orders] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch member orders', ErrorCode.INTERNAL_ERROR, { request });
  }
});

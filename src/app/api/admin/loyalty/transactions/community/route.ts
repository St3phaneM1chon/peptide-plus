export const dynamic = 'force-dynamic';

/**
 * Bridge #38: Fidélité → Communauté (Points earned from community activity)
 * GET /api/admin/loyalty/transactions/community
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
) => {
  try {
    const enabled = await isModuleEnabled('community');
    if (!enabled) return apiSuccess({ enabled: false }, { request });

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit') || '20'), 50);

    const transactions = await prisma.loyaltyTransaction.findMany({
      where: { type: 'EARN_REVIEW' },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, points: true, description: true, createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    const stats = await prisma.loyaltyTransaction.aggregate({
      where: { type: 'EARN_REVIEW' },
      _sum: { points: true },
      _count: true,
    });

    return apiSuccess({
      enabled: true,
      totalPoints: stats._sum.points ?? 0,
      totalTransactions: stats._count,
      transactions: transactions.map((t) => ({
        id: t.id,
        points: t.points,
        description: t.description,
        userName: t.user.name,
        userEmail: t.user.email,
        userId: t.user.id,
        date: t.createdAt,
      })),
    }, { request });
  } catch (error) {
    logger.error('[loyalty/transactions/community] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch community points', ErrorCode.INTERNAL_ERROR, { request });
  }
});

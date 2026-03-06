export const dynamic = 'force-dynamic';

/**
 * Bridge #37: Fidélité → Marketing (Loyalty members who used promos)
 * GET /api/admin/loyalty/transactions/promos
 *
 * Since PromoCode has no loyalty tier targeting field, this bridge
 * shows which loyalty members have used promo codes (cross-reference).
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
    const enabled = await isModuleEnabled('marketing');
    if (!enabled) return apiSuccess({ enabled: false }, { request });

    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get('limit') || '20'), 50);

    // PromoCodeUsage has promoCode relation but no user relation
    const usages = await prisma.promoCodeUsage.findMany({
      take: limit,
      orderBy: { usedAt: 'desc' },
      include: {
        promoCode: { select: { id: true, code: true, type: true, value: true } },
      },
    });

    // Fetch users separately
    const userIds = [...new Set(usages.map((u) => u.userId))];
    const [users, balances] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      }),
      userIds.length > 0
        ? prisma.loyaltyTransaction.groupBy({
            by: ['userId'],
            where: { userId: { in: userIds } },
            _sum: { points: true },
          })
        : Promise.resolve([]),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const balanceMap = new Map(balances.map((b) => [b.userId, b._sum.points ?? 0]));

    return apiSuccess({
      enabled: true,
      usages: usages.map((u) => {
        const user = userMap.get(u.userId);
        return {
          id: u.id,
          promoCode: u.promoCode.code,
          promoType: u.promoCode.type,
          promoValue: Number(u.promoCode.value),
          discount: Number(u.discount),
          userName: user?.name ?? null,
          userEmail: user?.email ?? null,
          userId: u.userId,
          loyaltyPoints: balanceMap.get(u.userId) ?? 0,
          date: u.usedAt,
        };
      }),
    }, { request });
  } catch (error) {
    logger.error('[loyalty/transactions/promos] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch promo usage', ErrorCode.INTERNAL_ERROR, { request });
  }
});

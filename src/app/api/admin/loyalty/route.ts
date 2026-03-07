export const dynamic = 'force-dynamic';

/**
 * Admin Loyalty Dashboard API
 * GET - Returns aggregated loyalty program stats
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    const [
      totalTransactions,
      totalMembers,
      totalPointsIssued,
      totalPointsRedeemed,
      recentTransactions,
    ] = await Promise.all([
      prisma.loyaltyTransaction.count(),
      prisma.user.count({ where: { loyaltyPoints: { gt: 0 } } }),
      prisma.loyaltyTransaction.aggregate({
        where: { type: { in: ['EARN_PURCHASE', 'EARN_REFERRAL', 'EARN_REVIEW', 'EARN_SIGNUP', 'EARN_BIRTHDAY', 'EARN_BONUS', 'EARN_REFERRAL_MILESTONE'] } },
        _sum: { points: true },
      }),
      prisma.loyaltyTransaction.aggregate({
        where: { type: { in: ['REDEEM_DISCOUNT', 'REDEEM_PRODUCT'] } },
        _sum: { points: true },
      }),
      prisma.loyaltyTransaction.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
        },
      }),
    ]);

    return NextResponse.json({
      totalTransactions,
      totalMembers,
      totalPointsIssued: totalPointsIssued._sum?.points || 0,
      totalPointsRedeemed: Math.abs(totalPointsRedeemed._sum?.points || 0),
      recentTransactions,
    });
  } catch (error) {
    logger.error('Admin loyalty dashboard GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

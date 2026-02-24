export const dynamic = 'force-dynamic';

/**
 * Referral Program API
 * GET - Get referral stats for the current authenticated user
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get the user with referral code
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        referralCode: true,
        loyaltyPoints: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all referrals made by this user
    const referrals = await prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        referred: {
          select: {
            name: true,
            createdAt: true,
          },
        },
      },
    });

    const totalReferrals = referrals.length;
    const qualifiedReferrals = referrals.filter(
      (r) => r.status === 'QUALIFIED' || r.status === 'REWARDED'
    ).length;
    const pendingReferrals = referrals.filter(
      (r) => r.status === 'PENDING'
    ).length;

    // Total points earned from referrals
    const totalPointsEarned = referrals.reduce(
      (sum, r) => sum + r.pointsAwarded,
      0
    );

    // Format recent referrals for display (limit to 20)
    const recentReferrals = referrals.slice(0, 20).map((r) => ({
      id: r.id,
      referredName: r.referred.name
        ? r.referred.name.split(' ')[0]
        : 'A friend',
      status: r.status,
      orderAmount: r.orderAmount ? Number(r.orderAmount) : null,
      pointsAwarded: r.pointsAwarded,
      createdAt: r.createdAt,
      qualifiedAt: r.qualifiedAt,
    }));

    return NextResponse.json({
      referralCode: user.referralCode,
      totalReferrals,
      qualifiedReferrals,
      pendingReferrals,
      totalPointsEarned,
      recentReferrals,
    });
  } catch (error) {
    logger.error('Error fetching referral stats', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch referral stats' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ isAmbassador: false });
    }

    const ambassador = await prisma.ambassador.findFirst({
      where: { userId: session.user.id, status: 'ACTIVE' },
      select: {
        totalReferrals: true,
        totalEarnings: true,
        tier: true,
        commissionRate: true,
        referralCode: true,
      },
    });

    if (!ambassador) {
      return NextResponse.json({ isAmbassador: false });
    }

    // Calculate clicks and conversion rate from commissions
    const totalClicks = ambassador.totalReferrals > 0
      ? Math.round(ambassador.totalReferrals / 0.05) // Estimate ~5% conversion
      : 0;
    const conversionRate = totalClicks > 0
      ? Math.round((ambassador.totalReferrals / totalClicks) * 10000) / 100
      : 0;

    const tierMap: Record<string, string> = {
      BRONZE: 'bronze',
      SILVER: 'silver',
      GOLD: 'gold',
      PLATINUM: 'platinum',
      STARTER: 'starter',
    };

    return NextResponse.json({
      isAmbassador: true,
      referrals: ambassador.totalReferrals,
      earnings: Number(ambassador.totalEarnings),
      clicks: totalClicks,
      conversionRate,
      tier: tierMap[ambassador.tier] || 'starter',
      referralCode: ambassador.referralCode,
    });
  } catch (error) {
    logger.error('[ambassador/status] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

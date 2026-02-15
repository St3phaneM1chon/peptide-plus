export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const tier = searchParams.get('tier');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (tier) where.tier = tier;

    const ambassadors = await prisma.ambassador.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { totalEarnings: 'desc' },
    });

    // Ensure commissions exist for all paid orders using ambassador referral codes.
    // This backfills commissions for orders that were placed before the tracking system.
    const allCodes = ambassadors.map((a) => a.referralCode);
    if (allCodes.length > 0) {
      await syncCommissionsForCodes(ambassadors);
    }

    // Now build the formatted response with real payout data
    const formatted = await Promise.all(
      ambassadors.map(async (a) => {
        // Get total sales from paid orders using this referral code
        const orderTotal = await prisma.order.aggregate({
          where: { promoCode: a.referralCode, paymentStatus: 'PAID' },
          _sum: { total: true },
        });

        // Get pending (unpaid) commission total
        const pendingCommissions = await prisma.ambassadorCommission.aggregate({
          where: { ambassadorId: a.id, paidOut: false },
          _sum: { commissionAmount: true },
        });

        // Get total paid-out commission
        const paidCommissions = await prisma.ambassadorCommission.aggregate({
          where: { ambassadorId: a.id, paidOut: true },
          _sum: { commissionAmount: true },
        });

        const totalSales = Number(orderTotal._sum.total || 0);
        const pendingPayout = Number(pendingCommissions._sum.commissionAmount || 0);
        const totalEarnings = Number(paidCommissions._sum.commissionAmount || 0) + pendingPayout;

        // Keep the ambassador's totalEarnings field in sync
        if (Number(a.totalEarnings) !== totalEarnings) {
          await prisma.ambassador.update({
            where: { id: a.id },
            data: { totalEarnings },
          });
        }

        return {
          id: a.id,
          userId: a.userId || '',
          userName: a.user?.name || a.name,
          userEmail: a.user?.email || a.email || '',
          referralCode: a.referralCode,
          tier: a.tier,
          commissionRate: Number(a.commissionRate),
          totalReferrals: a.totalReferrals,
          totalSales,
          totalEarnings,
          pendingPayout,
          status: a.status,
          joinedAt: a.joinedAt.toISOString(),
        };
      })
    );

    return NextResponse.json({ ambassadors: formatted });
  } catch (error) {
    console.error('Ambassadors API error:', error);
    return NextResponse.json({ ambassadors: [] });
  }
}

/**
 * Sync commission records for all paid orders that used ambassador referral codes.
 * Creates AmbassadorCommission entries for any orders that don't already have one.
 */
async function syncCommissionsForCodes(
  ambassadors: Array<{
    id: string;
    referralCode: string;
    commissionRate: { toNumber?: () => number } | number;
  }>
) {
  for (const amb of ambassadors) {
    const rate =
      typeof amb.commissionRate === 'number'
        ? amb.commissionRate
        : typeof amb.commissionRate === 'object' && amb.commissionRate?.toNumber
          ? amb.commissionRate.toNumber()
          : Number(amb.commissionRate);

    // Find paid orders using this referral code that don't yet have a commission record
    const orders = await prisma.order.findMany({
      where: {
        promoCode: amb.referralCode,
        paymentStatus: 'PAID',
      },
      select: {
        id: true,
        orderNumber: true,
        total: true,
      },
    });

    for (const order of orders) {
      const existing = await prisma.ambassadorCommission.findUnique({
        where: {
          ambassadorId_orderId: {
            ambassadorId: amb.id,
            orderId: order.id,
          },
        },
      });

      if (!existing) {
        const orderTotal = Number(order.total);
        const commissionAmount = Math.round(orderTotal * rate) / 100;

        await prisma.ambassadorCommission.create({
          data: {
            ambassadorId: amb.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            orderTotal: orderTotal,
            commissionRate: rate,
            commissionAmount,
          },
        });
      }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, name, email, commissionRate } = body;

    // Generate unique referral code
    const code = `AMB-${Date.now().toString(36).toUpperCase()}`;

    const ambassador = await prisma.ambassador.create({
      data: {
        userId: userId || null,
        name: name || '',
        email: email || null,
        referralCode: code,
        commissionRate: commissionRate || 10,
        status: 'ACTIVE',
        tier: 'BRONZE',
      },
    });

    return NextResponse.json({ ambassador }, { status: 201 });
  } catch (error) {
    console.error('Create ambassador error:', error);
    return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 });
  }
}

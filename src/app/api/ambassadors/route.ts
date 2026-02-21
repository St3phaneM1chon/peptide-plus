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

    // PERF 86: Batch aggregate all order totals, pending commissions, and paid commissions
    // in 3 queries instead of 3 * N per-ambassador queries.
    const allReferralCodes = ambassadors.map((a) => a.referralCode);
    const allAmbassadorIds = ambassadors.map((a) => a.id);

    const [orderTotals, pendingCommissionTotals, paidCommissionTotals] = await Promise.all([
      prisma.order.groupBy({
        by: ['promoCode'],
        where: { promoCode: { in: allReferralCodes }, paymentStatus: 'PAID' },
        _sum: { total: true },
      }),
      prisma.ambassadorCommission.groupBy({
        by: ['ambassadorId'],
        where: { ambassadorId: { in: allAmbassadorIds }, paidOut: false },
        _sum: { commissionAmount: true },
      }),
      prisma.ambassadorCommission.groupBy({
        by: ['ambassadorId'],
        where: { ambassadorId: { in: allAmbassadorIds }, paidOut: true },
        _sum: { commissionAmount: true },
      }),
    ]);

    const orderTotalMap = new Map(orderTotals.map((o) => [o.promoCode, Number(o._sum.total || 0)]));
    const pendingMap = new Map(pendingCommissionTotals.map((c) => [c.ambassadorId, Number(c._sum.commissionAmount || 0)]));
    const paidMap = new Map(paidCommissionTotals.map((c) => [c.ambassadorId, Number(c._sum.commissionAmount || 0)]));

    // Now build the formatted response with real payout data
    // First, collect ambassadors needing earnings sync to batch-update
    const earningsUpdates: Array<{ id: string; totalEarnings: number }> = [];

    const formatted = ambassadors.map((a) => {
      const totalSales = orderTotalMap.get(a.referralCode) || 0;
      const pendingPayout = pendingMap.get(a.id) || 0;
      const totalEarnings = (paidMap.get(a.id) || 0) + pendingPayout;

      // Collect out-of-sync ambassadors for batch update
      if (Number(a.totalEarnings) !== totalEarnings) {
        earningsUpdates.push({ id: a.id, totalEarnings });
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
    });

    // Batch sync earnings in the background (fire-and-forget, non-blocking)
    if (earningsUpdates.length > 0) {
      Promise.all(
        earningsUpdates.map(({ id, totalEarnings }) =>
          prisma.ambassador.update({ where: { id }, data: { totalEarnings } })
        )
      ).catch((err) => console.error('Ambassador earnings sync error:', err));
    }

    return NextResponse.json({ ambassadors: formatted });
  } catch (error) {
    console.error('Ambassadors API error:', error);
    return NextResponse.json({ ambassadors: [] });
  }
}

/**
 * Sync commission records for all paid orders that used ambassador referral codes.
 * Creates AmbassadorCommission entries for any orders that don't already have one.
 * Uses batch queries to avoid N+1 performance issues.
 */
async function syncCommissionsForCodes(
  ambassadors: Array<{
    id: string;
    referralCode: string;
    commissionRate: { toNumber?: () => number } | number;
  }>
) {
  // Build lookup maps
  const codeToAmbassador = new Map(ambassadors.map(a => [a.referralCode, a]));
  const allCodes = ambassadors.map(a => a.referralCode);

  // Batch: fetch ALL paid orders that used any ambassador referral code
  const allOrders = await prisma.order.findMany({
    where: {
      promoCode: { in: allCodes },
      paymentStatus: 'PAID',
    },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      promoCode: true,
    },
  });

  if (allOrders.length === 0) return;

  // Batch: fetch ALL existing commissions for these ambassadors
  const allAmbassadorIds = ambassadors.map(a => a.id);
  const existingCommissions = await prisma.ambassadorCommission.findMany({
    where: { ambassadorId: { in: allAmbassadorIds } },
    select: { ambassadorId: true, orderId: true },
  });

  // Build a Set of "ambassadorId:orderId" for O(1) lookup
  const existingSet = new Set(
    existingCommissions.map(c => `${c.ambassadorId}:${c.orderId}`)
  );

  // Collect new commissions to create
  const newCommissions: Array<{
    ambassadorId: string;
    orderId: string;
    orderNumber: string;
    orderTotal: number;
    commissionRate: number;
    commissionAmount: number;
  }> = [];

  for (const order of allOrders) {
    if (!order.promoCode) continue;
    const amb = codeToAmbassador.get(order.promoCode);
    if (!amb) continue;

    const key = `${amb.id}:${order.id}`;
    if (existingSet.has(key)) continue;

    const rate =
      typeof amb.commissionRate === 'number'
        ? amb.commissionRate
        : typeof amb.commissionRate === 'object' && amb.commissionRate?.toNumber
          ? amb.commissionRate.toNumber()
          : Number(amb.commissionRate);

    const orderTotal = Number(order.total);
    const commissionAmount = Math.round(orderTotal * rate) / 100;

    newCommissions.push({
      ambassadorId: amb.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderTotal,
      commissionRate: rate,
      commissionAmount,
    });
  }

  // Batch create all new commissions
  if (newCommissions.length > 0) {
    await prisma.ambassadorCommission.createMany({
      data: newCommissions,
      skipDuplicates: true,
    });
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

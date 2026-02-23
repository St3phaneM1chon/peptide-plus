export const dynamic = 'force-dynamic';

/**
 * Admin Loyalty Transactions API
 * GET - List all loyalty transactions with user info
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

// GET /api/admin/loyalty/transactions - List loyalty transactions
export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const userId = searchParams.get('userId');
    const search = searchParams.get('search');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (type) {
      where.type = type;
    }

    if (userId) {
      where.userId = userId;
    }

    if (search) {
      // Search by user name or email
      const matchingUsers = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      where.userId = { in: matchingUsers.map((u) => u.id) };
    }

    if (from || to) {
      where.createdAt = {};
      if (from) {
        (where.createdAt as Record<string, unknown>).gte = new Date(from);
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, unknown>).lte = toDate;
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.loyaltyTransaction.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              loyaltyTier: true,
              loyaltyPoints: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.loyaltyTransaction.count({ where }),
    ]);

    // Format for frontend
    const formattedTransactions = transactions.map((tx) => ({
      id: tx.id,
      userId: tx.userId,
      userName: tx.user.name || 'Unknown',
      userEmail: tx.user.email,
      userTier: tx.user.loyaltyTier,
      userCurrentPoints: tx.user.loyaltyPoints,
      type: tx.type,
      points: tx.points,
      description: tx.description,
      orderId: tx.orderId,
      referralId: tx.referralId,
      balanceAfter: tx.balanceAfter,
      metadata: tx.metadata ? JSON.parse(tx.metadata) : null,
      createdAt: tx.createdAt.toISOString(),
      expiresAt: tx.expiresAt?.toISOString() || null,
    }));

    // Summary stats
    const stats = await prisma.loyaltyTransaction.aggregate({
      where,
      _sum: { points: true },
      _count: true,
    });

    const earnedTotal = await prisma.loyaltyTransaction.aggregate({
      where: {
        ...where,
        points: { gt: 0 },
      },
      _sum: { points: true },
    });

    const redeemedTotal = await prisma.loyaltyTransaction.aggregate({
      where: {
        ...where,
        points: { lt: 0 },
      },
      _sum: { points: true },
    });

    return NextResponse.json({
      transactions: formattedTransactions,
      stats: {
        totalTransactions: stats._count,
        netPoints: stats._sum.points || 0,
        totalEarned: earnedTotal._sum.points || 0,
        totalRedeemed: Math.abs(redeemedTotal._sum.points || 0),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    logger.error('Admin loyalty transactions GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

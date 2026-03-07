export const dynamic = 'force-dynamic';

/**
 * Admin Loyalty History API
 * GET - List loyalty point exchange/redemption history
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

// GET /api/admin/loyalty/history - List loyalty exchange history (redemptions)
export const GET = withAdminGuard(async (request: NextRequest, _ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;
    const type = searchParams.get('type'); // REDEEM, EARN, etc.

    const where: Record<string, unknown> = {};
    if (type) {
      where.type = type;
    } else {
      // Default: show redemptions (exchanges)
      where.type = 'REDEEM';
    }

    const [transactions, total] = await Promise.all([
      prisma.loyaltyTransaction.findMany({
        where,
        select: {
          id: true,
          userId: true,
          type: true,
          points: true,
          description: true,
          orderId: true,
          balanceAfter: true,
          metadata: true,
          createdAt: true,
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

    const history = transactions.map((tx) => ({
      id: tx.id,
      userId: tx.userId,
      userName: tx.user.name || 'Unknown',
      userEmail: tx.user.email,
      userTier: tx.user.loyaltyTier,
      type: tx.type,
      points: tx.points,
      description: tx.description,
      orderId: tx.orderId,
      balanceAfter: tx.balanceAfter,
      metadata: tx.metadata ? JSON.parse(tx.metadata) : null,
      createdAt: tx.createdAt.toISOString(),
    }));

    return NextResponse.json({
      history,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    logger.error('Admin loyalty history GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

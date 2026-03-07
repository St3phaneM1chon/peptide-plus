export const dynamic = 'force-dynamic';

/**
 * Admin Loyalty Members API
 * GET - List loyalty program members (users with points > 0) with pagination
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;
    const search = searchParams.get('search');
    const tier = searchParams.get('tier');

    const where: Record<string, unknown> = {
      loyaltyPoints: { gt: 0 },
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (tier) {
      where.loyaltyTier = tier;
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        take: limit,
        skip,
        orderBy: { loyaltyPoints: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          loyaltyPoints: true,
          loyaltyTier: true,
          createdAt: true,
          _count: { select: { loyaltyTransactions: true, orders: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    logger.error('Admin loyalty members GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

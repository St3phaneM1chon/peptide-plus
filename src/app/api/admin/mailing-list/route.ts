export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || '';

    const where = {
      ...(status ? { status: status as 'PENDING' | 'ACTIVE' | 'UNSUBSCRIBED' | 'BOUNCED' } : {}),
      ...(search ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [subscribers, total, statusCounts] = await Promise.all([
      prisma.mailingListSubscriber.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          consentType: true,
          consentMethod: true,
          createdAt: true,
          updatedAt: true,
          confirmedAt: true,
          unsubscribedAt: true,
          preferences: {
            select: {
              id: true,
              category: true,
              isEnabled: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.mailingListSubscriber.count({ where }),
      prisma.mailingListSubscriber.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    return NextResponse.json({ subscribers, total, page, limit, statusCounts });
  } catch (error) {
    logger.error('Admin mailing list GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

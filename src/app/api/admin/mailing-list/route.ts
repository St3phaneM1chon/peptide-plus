export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

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
        include: { preferences: true },
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
    console.error('Admin mailing list GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

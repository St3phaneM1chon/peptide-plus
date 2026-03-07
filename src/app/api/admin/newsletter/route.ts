export const dynamic = 'force-dynamic';

/**
 * Admin Newsletter API
 * GET - List newsletter subscribers with pagination
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

    const where: Record<string, unknown> = {};
    if (search) {
      where.email = { contains: search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        where,
        take: limit,
        skip,
        orderBy: { subscribedAt: 'desc' },
      }),
      prisma.newsletterSubscriber.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    logger.error('Admin newsletter GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

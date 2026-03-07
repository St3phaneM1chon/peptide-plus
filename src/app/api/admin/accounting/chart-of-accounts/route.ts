export const dynamic = 'force-dynamic';

/**
 * Admin Chart of Accounts API
 * GET - List chart of accounts with pagination
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const skip = (page - 1) * limit;
    const type = searchParams.get('type');

    const where: Record<string, unknown> = {};
    if (type) {
      where.type = type;
    }

    const [data, total] = await Promise.all([
      prisma.chartOfAccount.findMany({
        where,
        take: limit,
        skip,
        orderBy: { code: 'asc' },
      }),
      prisma.chartOfAccount.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    logger.error('Admin chart of accounts GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

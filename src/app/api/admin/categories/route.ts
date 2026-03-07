export const dynamic = 'force-dynamic';

/**
 * Admin Categories API
 * GET - List product categories with hierarchy
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
    const flat = searchParams.get('flat') === 'true';

    const [data, total] = await Promise.all([
      prisma.category.findMany({
        where: flat ? {} : { parentId: null },
        take: limit,
        skip,
        orderBy: { sortOrder: 'asc' },
        include: {
          translations: true,
          children: {
            orderBy: { sortOrder: 'asc' },
            include: { translations: true },
          },
          _count: { select: { products: true } },
        },
      }),
      prisma.category.count(flat ? undefined : { where: { parentId: null } }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    logger.error('Admin categories GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

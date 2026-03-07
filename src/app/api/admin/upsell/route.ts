export const dynamic = 'force-dynamic';

/**
 * Admin Upsell Rules API
 * GET - List upsell configurations with pagination
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

    const [data, total] = await Promise.all([
      prisma.upsellConfig.findMany({
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.upsellConfig.count(),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    logger.error('Admin upsell GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

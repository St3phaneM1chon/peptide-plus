export const dynamic = 'force-dynamic';

/**
 * ADMIN - Cache Statistics
 *
 * Improvement #33: Cache metrics endpoint for admin
 *
 * GET /api/admin/cache-stats
 */

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { cacheStats, isCacheRedisConnected } from '@/lib/cache';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    const stats = await cacheStats();

    return NextResponse.json({
      cache: {
        ...stats,
        redisConnected: isCacheRedisConnected(),
      },
    });
  } catch (error) {
    logger.error('[admin/cache-stats] GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to fetch cache stats' }, { status: 500 });
  }
});

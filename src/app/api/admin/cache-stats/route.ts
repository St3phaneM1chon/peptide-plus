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

export const GET = withAdminGuard(async () => {
  const stats = await cacheStats();

  return NextResponse.json({
    cache: {
      ...stats,
      redisConnected: isCacheRedisConnected(),
    },
  });
});

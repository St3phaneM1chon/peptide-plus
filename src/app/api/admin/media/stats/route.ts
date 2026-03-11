export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/media/stats
 *
 * Returns storage statistics: total usage, file count, and breakdown by MIME
 * type category. Leverages StorageService.getStorageStats() for aggregation.
 *
 * Authentication: Admin guard (EMPLOYEE or OWNER role required).
 */

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { storage } from '@/lib/storage';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (_request, { session }) => {
  try {
    const stats = await storage.getStorageStats(
      session.user.role === 'OWNER' ? undefined : session.user.id
    );

    return NextResponse.json(stats);
  } catch (error) {
    logger.error('[media/stats] Failed to get storage stats', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { skipCsrf: true });

/**
 * GET /api/admin/metrics
 * Returns business metrics summary for admin dashboard.
 * Requires EMPLOYEE or OWNER role.
 */

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getMetricsSummary } from '@/lib/metrics';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    const summary = getMetricsSummary();

    return NextResponse.json({
      data: summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[admin/metrics] GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
});

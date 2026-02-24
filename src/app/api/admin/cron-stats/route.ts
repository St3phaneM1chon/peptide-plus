export const dynamic = 'force-dynamic';

/**
 * ADMIN - Cron Job Statistics
 *
 * Improvement #38: Cron monitoring endpoint
 * Improvement #44: Health check for stale cron jobs
 *
 * GET /api/admin/cron-stats
 */

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getAllCronStats, getUnhealthyCronJobs } from '@/lib/cron-monitor';
import { getRunningJobs } from '@/lib/cron-lock';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    const [allStats, unhealthy, running] = await Promise.all([
      getAllCronStats(),
      getUnhealthyCronJobs(),
      Promise.resolve(getRunningJobs()),
    ]);

    return NextResponse.json({
      jobs: allStats,
      unhealthy: unhealthy.map(j => j.jobName),
      currentlyRunning: running,
      summary: {
        totalJobs: allStats.length,
        healthyCount: allStats.filter(j => j.isHealthy).length,
        unhealthyCount: unhealthy.length,
        runningCount: running.length,
      },
    });
  } catch (error) {
    logger.error('Cron stats GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch cron stats' },
      { status: 500 }
    );
  }
});

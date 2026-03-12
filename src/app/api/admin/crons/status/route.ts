export const dynamic = 'force-dynamic';

/**
 * ADMIN - Cron Monitoring Dashboard API
 *
 * T4-1: Comprehensive cron job status endpoint.
 * Combines the cron registry with live stats from Redis/memory
 * to provide a full picture of all 34 cron jobs.
 *
 * GET /api/admin/crons/status
 */

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getCronJobStats } from '@/lib/cron-monitor';
import { getRunningJobs } from '@/lib/cron-lock';
import { CRON_REGISTRY, describeSchedule, CRON_CATEGORY_LABELS } from '@/lib/cron-registry';
import type { CronCategory } from '@/lib/cron-registry';
import { logger } from '@/lib/logger';

/**
 * Estimate the next run time based on the cron schedule and last run time.
 * Simple heuristic: lastRun + expectedInterval. If never ran, returns null.
 */
function estimateNextRun(lastRunAt: string | null, expectedIntervalMs: number): string | null {
  if (!lastRunAt) return null;
  const lastRun = new Date(lastRunAt).getTime();
  if (isNaN(lastRun)) return null;
  const next = lastRun + expectedIntervalMs;
  // If next run is in the past, the next one is now + remaining interval
  if (next < Date.now()) {
    const elapsed = Date.now() - lastRun;
    const cyclesPassed = Math.floor(elapsed / expectedIntervalMs);
    const nextCycle = lastRun + (cyclesPassed + 1) * expectedIntervalMs;
    return new Date(nextCycle).toISOString();
  }
  return new Date(next).toISOString();
}

export const GET = withAdminGuard(async () => {
  try {
    const running = getRunningJobs();
    const runningNames = new Set(running.map(j => j.name));

    // Fetch stats for all registered crons in parallel
    const statsResults = await Promise.all(
      CRON_REGISTRY.map(async (def) => {
        const stats = await getCronJobStats(def.name);

        const isRunning = runningNames.has(def.name);
        const isOverdue = !stats.isHealthy && stats.totalRuns > 0;
        const neverRan = stats.totalRuns === 0;

        let status: 'ok' | 'running' | 'error' | 'overdue' | 'never_ran';
        if (isRunning) {
          status = 'running';
        } else if (stats.totalErrors > 0 && stats.totalErrors === stats.totalRuns) {
          status = 'error';
        } else if (isOverdue) {
          status = 'overdue';
        } else if (neverRan) {
          status = 'never_ran';
        } else {
          status = 'ok';
        }

        return {
          name: def.name,
          label: def.label,
          description: def.description,
          category: def.category,
          categoryLabel: CRON_CATEGORY_LABELS[def.category],
          schedule: def.schedule,
          scheduleHuman: describeSchedule(def.schedule),
          method: def.method,
          status,
          lastRunAt: stats.lastRunAt,
          lastDurationMs: stats.lastDurationMs,
          totalRuns: stats.totalRuns,
          totalErrors: stats.totalErrors,
          errorRate: stats.totalRuns > 0
            ? Math.round((stats.totalErrors / stats.totalRuns) * 100)
            : 0,
          avgDurationMs: stats.avgDurationMs,
          isHealthy: stats.isHealthy,
          expectedIntervalMs: def.expectedIntervalMs,
          nextRunEstimate: estimateNextRun(stats.lastRunAt, def.expectedIntervalMs),
        };
      })
    );

    // Group by category
    const byCategory: Record<string, typeof statsResults> = {};
    for (const job of statsResults) {
      const cat = job.category;
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(job);
    }

    // Summary counts
    const summary = {
      totalJobs: statsResults.length,
      okCount: statsResults.filter(j => j.status === 'ok').length,
      runningCount: statsResults.filter(j => j.status === 'running').length,
      errorCount: statsResults.filter(j => j.status === 'error').length,
      overdueCount: statsResults.filter(j => j.status === 'overdue').length,
      neverRanCount: statsResults.filter(j => j.status === 'never_ran').length,
    };

    // Categories for filtering
    const categories = Object.entries(CRON_CATEGORY_LABELS).map(([key, label]) => ({
      key: key as CronCategory,
      label,
      count: byCategory[key]?.length || 0,
    }));

    return NextResponse.json({
      jobs: statsResults,
      byCategory,
      categories,
      summary,
      currentlyRunning: running,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Cron status GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to fetch cron status' },
      { status: 500 }
    );
  }
});

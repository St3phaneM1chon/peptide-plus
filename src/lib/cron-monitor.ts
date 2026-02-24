/**
 * CRON JOB MONITORING
 *
 * Improvement #38: Track cron job executions
 * Improvement #44: Health check - alert if job hasn't run in 2x its interval
 *
 * Stores stats in Redis or in-memory:
 *   cron:last-run:{jobName} -> timestamp
 *   cron:stats:{jobName} -> { runs, errors, avgDuration, lastDuration }
 */

import { getRedisClient, isRedisAvailable } from '@/lib/redis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CronJobStats {
  jobName: string;
  lastRunAt: string | null;
  lastDurationMs: number;
  totalRuns: number;
  totalErrors: number;
  avgDurationMs: number;
  isHealthy: boolean;
  expectedIntervalMs: number;
}

// ---------------------------------------------------------------------------
// Known cron intervals (milliseconds)
// ---------------------------------------------------------------------------

const CRON_INTERVALS: Record<string, number> = {
  'update-exchange-rates': 6 * 60 * 60 * 1000,  // every 6 hours
  'abandoned-cart': 2 * 60 * 60 * 1000,          // every 2 hours
  'birthday-emails': 24 * 60 * 60 * 1000,        // daily at 9am
  'points-expiring': 24 * 60 * 60 * 1000,        // daily
  'stock-alerts': 60 * 60 * 1000,                 // every hour
  'price-drop-alerts': 24 * 60 * 60 * 1000,       // daily
  'release-reservations': 60 * 60 * 1000,          // every hour
  'satisfaction-survey': 24 * 60 * 60 * 1000,      // daily
  'welcome-series': 24 * 60 * 60 * 1000,           // daily
};

// In-memory fallback
const memStats = new Map<string, {
  lastRunAt: number;
  lastDurationMs: number;
  totalRuns: number;
  totalErrors: number;
  totalDurationMs: number;
}>();

const REDIS_PREFIX = 'cron:';

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

/**
 * Record the start of a cron job execution.
 * Returns a finish() function to call when the job completes.
 */
export function trackCronExecution(jobName: string): {
  finish: (error?: Error | null) => Promise<void>;
} {
  const startTime = Date.now();

  return {
    finish: async (error?: Error | null) => {
      const durationMs = Date.now() - startTime;
      const now = new Date().toISOString();

      if (isRedisAvailable()) {
        try {
          const redis = await getRedisClient();
          if (redis) {
            const statsKey = `${REDIS_PREFIX}stats:${jobName}`;
            await redis.hset(statsKey,
              'lastRunAt', now,
              'lastDurationMs', String(durationMs),
            );
            await redis.hincrby(statsKey, 'totalRuns', 1);
            if (error) {
              await redis.hincrby(statsKey, 'totalErrors', 1);
            }
            await redis.hincrby(statsKey, 'totalDurationMs', durationMs);

            // Set a TTL on the stats key so it auto-cleans if job is removed
            await redis.expire(statsKey, 7 * 24 * 60 * 60); // 7 days
            return;
          }
        } catch {
          // Fall through to memory
        }
      }

      // Memory fallback
      const existing = memStats.get(jobName) || {
        lastRunAt: 0,
        lastDurationMs: 0,
        totalRuns: 0,
        totalErrors: 0,
        totalDurationMs: 0,
      };

      existing.lastRunAt = startTime;
      existing.lastDurationMs = durationMs;
      existing.totalRuns++;
      if (error) existing.totalErrors++;
      existing.totalDurationMs += durationMs;

      memStats.set(jobName, existing);
    },
  };
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/**
 * Get stats for a specific cron job
 */
export async function getCronJobStats(jobName: string): Promise<CronJobStats> {
  const expectedInterval = CRON_INTERVALS[jobName] || 24 * 60 * 60 * 1000;

  if (isRedisAvailable()) {
    try {
      const redis = await getRedisClient();
      if (redis) {
        const stats = await redis.hgetall(`${REDIS_PREFIX}stats:${jobName}`);

        if (stats && stats.lastRunAt) {
          const totalRuns = parseInt(stats.totalRuns || '0', 10);
          const totalDurationMs = parseInt(stats.totalDurationMs || '0', 10);

          const lastRunDate = new Date(stats.lastRunAt);
          const timeSinceLastRun = Date.now() - lastRunDate.getTime();
          const isHealthy = timeSinceLastRun < expectedInterval * 2;

          return {
            jobName,
            lastRunAt: stats.lastRunAt,
            lastDurationMs: parseInt(stats.lastDurationMs || '0', 10),
            totalRuns,
            totalErrors: parseInt(stats.totalErrors || '0', 10),
            avgDurationMs: totalRuns > 0 ? Math.round(totalDurationMs / totalRuns) : 0,
            isHealthy,
            expectedIntervalMs: expectedInterval,
          };
        }
      }
    } catch {
      // Fall through
    }
  }

  // Memory fallback
  const stats = memStats.get(jobName);
  if (stats) {
    const timeSinceLastRun = Date.now() - stats.lastRunAt;
    return {
      jobName,
      lastRunAt: stats.lastRunAt ? new Date(stats.lastRunAt).toISOString() : null,
      lastDurationMs: stats.lastDurationMs,
      totalRuns: stats.totalRuns,
      totalErrors: stats.totalErrors,
      avgDurationMs: stats.totalRuns > 0 ? Math.round(stats.totalDurationMs / stats.totalRuns) : 0,
      isHealthy: timeSinceLastRun < expectedInterval * 2,
      expectedIntervalMs: expectedInterval,
    };
  }

  return {
    jobName,
    lastRunAt: null,
    lastDurationMs: 0,
    totalRuns: 0,
    totalErrors: 0,
    avgDurationMs: 0,
    isHealthy: false, // Never ran
    expectedIntervalMs: expectedInterval,
  };
}

/**
 * Get stats for all known cron jobs
 */
export async function getAllCronStats(): Promise<CronJobStats[]> {
  const jobs = Object.keys(CRON_INTERVALS);
  return Promise.all(jobs.map(getCronJobStats));
}

/**
 * Improvement #44: Check which cron jobs are unhealthy
 * Returns jobs that haven't run in 2x their expected interval
 */
export async function getUnhealthyCronJobs(): Promise<CronJobStats[]> {
  const allStats = await getAllCronStats();
  return allStats.filter(s => !s.isHealthy);
}

/**
 * Register a custom cron interval (for new/dynamic cron jobs)
 */
export function registerCronInterval(jobName: string, intervalMs: number): void {
  CRON_INTERVALS[jobName] = intervalMs;
}

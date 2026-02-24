/**
 * CRON JOB OVERLAP PROTECTION - Distributed with Redis
 *
 * Improvement #36: Uses Redis SETNX for distributed lock
 * Improvement #39: Timeout protection with AbortController
 *
 * Prevents multiple instances of the same cron job from running simultaneously.
 * Works across multiple server instances when Redis is available.
 * Falls back to in-memory Map when Redis is unavailable.
 *
 * Usage:
 *   import { withJobLock } from '@/lib/cron-lock';
 *
 *   export async function GET(request: NextRequest) {
 *     return withJobLock('update-exchange-rates', async (signal) => {
 *       // ... your cron logic, check signal.aborted for timeout ...
 *       return NextResponse.json({ success: true });
 *     }, { maxDurationMs: 30000 });
 *   }
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getRedisClient, isRedisAvailable } from '@/lib/redis';
import { trackCronExecution } from '@/lib/cron-monitor';

// In-memory fallback for single-instance deployments
const runningJobs = new Map<string, { startedAt: number }>();

const LOCK_PREFIX = 'cron-lock:';
const DEFAULT_MAX_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const LOCK_MARGIN_MS = 30 * 1000; // 30 second safety margin on lock TTL

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

interface JobLockOptions {
  /** Maximum duration before the job is considered stuck. Default: 5 minutes */
  maxDurationMs?: number;
  /** Whether to use timeout protection via AbortController. Default: true */
  enableTimeout?: boolean;
}

// ---------------------------------------------------------------------------
// Redis distributed lock
// ---------------------------------------------------------------------------

async function acquireRedisLock(jobName: string, ttlMs: number): Promise<boolean> {
  if (!isRedisAvailable()) return false;

  try {
    const redis = await getRedisClient();
    if (!redis) return false;

    const lockKey = `${LOCK_PREFIX}${jobName}`;
    const lockValue = `${process.env.HOSTNAME || 'local'}:${Date.now()}`;
    const ttlSeconds = Math.ceil(ttlMs / 1000);

    // SETNX: set only if not exists
    const result = await redis.setnx(lockKey, lockValue);
    if (result === 1) {
      // Lock acquired - set TTL
      await redis.expire(lockKey, ttlSeconds);
      return true;
    }

    return false;
  } catch (err) {
    logger.warn('[cron-lock] Redis lock acquisition failed', {
      job: jobName,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

async function releaseRedisLock(jobName: string): Promise<void> {
  if (!isRedisAvailable()) return;

  try {
    const redis = await getRedisClient();
    if (redis) {
      await redis.del(`${LOCK_PREFIX}${jobName}`);
    }
  } catch (error) {
    console.error('[CronLock] Redis lock release failed (will expire via TTL):', error);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute a cron handler only if no other instance of the same job is running.
 * Returns a 409 Conflict response if the job is already in progress.
 *
 * Improvement #36: Uses Redis SETNX for distributed locking
 * Improvement #39: AbortController timeout protection
 */
export async function withJobLock<T extends NextResponse>(
  jobName: string,
  fn: (signal: AbortSignal) => Promise<T>,
  options: JobLockOptions = {},
): Promise<T> {
  const { maxDurationMs = DEFAULT_MAX_DURATION_MS, enableTimeout = true } = options;
  const lockTtlMs = maxDurationMs + LOCK_MARGIN_MS;

  // Try Redis distributed lock first
  const redisLocked = await acquireRedisLock(jobName, lockTtlMs);

  if (!redisLocked) {
    // Check if Redis lock exists (another instance has it)
    if (isRedisAvailable()) {
      const redis = await getRedisClient();
      if (redis) {
        const existingLock = await redis.get(`${LOCK_PREFIX}${jobName}`).catch(() => null);
        if (existingLock) {
          logger.warn('Cron job skipped: Redis lock held by another instance', {
            job: jobName,
            lockHolder: existingLock,
          });
          return NextResponse.json(
            {
              skipped: true,
              reason: `Job "${jobName}" is locked by another instance`,
            },
            { status: 409 },
          ) as T;
        }
      }
    }

    // Fallback: check in-memory lock
    const existing = runningJobs.get(jobName);
    if (existing) {
      const elapsedMs = Date.now() - existing.startedAt;
      logger.warn('Cron job skipped: already running (memory lock)', {
        job: jobName,
        runningForMs: elapsedMs,
      });
      return NextResponse.json(
        {
          skipped: true,
          reason: `Job "${jobName}" is already running (started ${Math.round(elapsedMs / 1000)}s ago)`,
        },
        { status: 409 },
      ) as T;
    }
  }

  // Set in-memory lock as well (for same-process protection)
  runningJobs.set(jobName, { startedAt: Date.now() });

  // Improvement #39: AbortController for timeout protection
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = null;

  if (enableTimeout) {
    timeout = setTimeout(() => {
      controller.abort();
      logger.error('Cron job timed out', {
        job: jobName,
        maxDurationMs,
      });
    }, maxDurationMs);
  }

  // Improvement #38: Track execution for monitoring
  const tracker = trackCronExecution(jobName);
  let error: Error | null = null;

  try {
    const result = await fn(controller.signal);
    return result;
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err));
    throw err;
  } finally {
    if (timeout) clearTimeout(timeout);
    runningJobs.delete(jobName);
    await releaseRedisLock(jobName);
    await tracker.finish(error);
  }
}

/**
 * Check if a specific job is currently running.
 */
export function isJobRunning(jobName: string): boolean {
  return runningJobs.has(jobName);
}

/**
 * Get all currently running jobs (for health/debug endpoints).
 */
export function getRunningJobs(): Array<{ name: string; startedAt: number; elapsedMs: number }> {
  const now = Date.now();
  return Array.from(runningJobs.entries()).map(([name, info]) => ({
    name,
    startedAt: info.startedAt,
    elapsedMs: now - info.startedAt,
  }));
}

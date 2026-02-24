/**
 * JOB QUEUE SYSTEM - Simple Redis-based job queue
 *
 * Improvement #37: Simple queue using Redis LIST (LPUSH/BRPOP)
 * Improvement #41: Priority system (higher priority = processed first)
 * Improvement #42: Retry with exponential backoff
 * Improvement #43: Dead letter queue for jobs that fail 3+ times
 * Improvement #45: Dry-run mode for testing
 *
 * Job types: send-email, generate-pdf, sync-stripe, process-webhook
 */

import { logger } from '@/lib/logger';
import { getRedisClient, isRedisAvailable } from '@/lib/redis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JobPayload {
  type: string;
  data: Record<string, unknown>;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  maxRetries?: number;
  retryCount?: number;
  createdAt?: string;
  scheduledAt?: string;
}

export interface Job extends JobPayload {
  id: string;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  lastError?: string;
}

export type JobHandler = (job: Job) => Promise<void>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUEUE_PREFIX = 'jobq:';
const DLQ_PREFIX = 'jobq:dlq:';
const STATS_KEY = 'jobq:stats';
const MAX_RETRIES_DEFAULT = 3;
const BACKOFF_BASE_MS = 1000; // 1 second

// Priority multipliers (higher = processed first via separate queues)
// const PRIORITY_QUEUES: Record<string, string> = {
//   critical: 'critical', high: 'high', normal: 'normal', low: 'low',
// };

// In-memory fallback queue
const memoryQueues = new Map<string, Job[]>();
const dlqMemory = new Map<string, Job[]>();

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Enqueue a job for processing
 * Improvement #41: Jobs are placed in priority-specific sub-queues
 */
export async function enqueue(
  jobType: string,
  payload: Record<string, unknown>,
  options: {
    priority?: 'low' | 'normal' | 'high' | 'critical';
    maxRetries?: number;
    scheduledAt?: string;
  } = {}
): Promise<string> {
  const { priority = 'normal', maxRetries = MAX_RETRIES_DEFAULT, scheduledAt } = options;

  const job: Job = {
    // AMELIORATION: Use crypto.randomUUID instead of Math.random for job IDs
    id: `${jobType}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    type: jobType,
    data: payload,
    priority,
    maxRetries,
    retryCount: 0,
    createdAt: new Date().toISOString(),
    scheduledAt,
  };

  const queueKey = `${QUEUE_PREFIX}${priority}:${jobType}`;

  if (isRedisAvailable()) {
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.lpush(queueKey, JSON.stringify(job));
        await redis.hincrby(STATS_KEY, `enqueued:${jobType}`, 1);
        logger.debug('[job-queue] Enqueued job', { id: job.id, type: jobType, priority });
        return job.id;
      }
    } catch (err) {
      logger.warn('[job-queue] Redis enqueue failed, using memory fallback', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Memory fallback
  if (!memoryQueues.has(queueKey)) {
    memoryQueues.set(queueKey, []);
  }
  memoryQueues.get(queueKey)!.push(job);
  logger.debug('[job-queue] Enqueued job (memory)', { id: job.id, type: jobType });

  return job.id;
}

/**
 * Process jobs from the queue
 * Improvement #42: Retry with exponential backoff on failure
 * Improvement #43: Dead letter queue for repeated failures
 */
export async function processQueue(
  jobType: string,
  handler: JobHandler,
  options: {
    concurrency?: number;
    batchSize?: number;
    dryRun?: boolean; // Improvement #45
  } = {}
): Promise<{ processed: number; failed: number; dlq: number }> {
  const { batchSize = 10, dryRun = false } = options;
  let processed = 0;
  let failed = 0;
  let dlq = 0;

  // Process queues in priority order: critical > high > normal > low
  const priorities = ['critical', 'high', 'normal', 'low'];

  for (const priority of priorities) {
    const queueKey = `${QUEUE_PREFIX}${priority}:${jobType}`;
    let batchRemaining = batchSize - processed;

    while (batchRemaining > 0) {
      const job = await dequeueOne(queueKey);
      if (!job) break;

      // Check if scheduled for later
      if (job.scheduledAt && new Date(job.scheduledAt) > new Date()) {
        // Put it back
        await requeueJob(queueKey, job);
        break;
      }

      if (dryRun) {
        logger.info('[job-queue] DRY RUN - would process job', { id: job.id, type: job.type, data: job.data });
        processed++;
        batchRemaining--;
        continue;
      }

      try {
        await handler(job);
        processed++;

        // Update stats
        if (isRedisAvailable()) {
          const redis = await getRedisClient();
          if (redis) {
            await redis.hincrby(STATS_KEY, `processed:${jobType}`, 1).catch(() => {});
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        job.lastError = errorMsg;
        job.retryCount++;

        if (job.retryCount >= job.maxRetries) {
          // Move to dead letter queue (Improvement #43)
          await moveToDLQ(jobType, job);
          dlq++;
          logger.error('[job-queue] Job moved to DLQ after max retries', {
            id: job.id,
            type: job.type,
            retries: job.retryCount,
            error: errorMsg,
          });
        } else {
          // Retry with exponential backoff (Improvement #42)
          const backoffMs = BACKOFF_BASE_MS * Math.pow(2, job.retryCount - 1);
          job.scheduledAt = new Date(Date.now() + backoffMs).toISOString();
          await requeueJob(queueKey, job);
          logger.warn('[job-queue] Job will retry', {
            id: job.id,
            type: job.type,
            retryCount: job.retryCount,
            nextRetryMs: backoffMs,
            error: errorMsg,
          });
        }
        failed++;
      }

      batchRemaining--;
    }
  }

  return { processed, failed, dlq };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function dequeueOne(queueKey: string): Promise<Job | null> {
  if (isRedisAvailable()) {
    try {
      const redis = await getRedisClient();
      if (redis) {
        const raw = await redis.rpop(queueKey);
        if (raw) return JSON.parse(raw) as Job;
        return null;
      }
    } catch (error) {
      console.error('[JobQueue] Redis dequeue failed, falling through to memory:', error);
    }
  }

  // Memory fallback
  const queue = memoryQueues.get(queueKey);
  if (!queue || queue.length === 0) return null;
  return queue.shift() || null;
}

async function requeueJob(queueKey: string, job: Job): Promise<void> {
  if (isRedisAvailable()) {
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.lpush(queueKey, JSON.stringify(job));
        return;
      }
    } catch (error) {
      console.error('[JobQueue] Redis requeue failed, falling through to memory:', error);
    }
  }

  if (!memoryQueues.has(queueKey)) {
    memoryQueues.set(queueKey, []);
  }
  memoryQueues.get(queueKey)!.push(job);
}

async function moveToDLQ(jobType: string, job: Job): Promise<void> {
  const dlqKey = `${DLQ_PREFIX}${jobType}`;

  if (isRedisAvailable()) {
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.lpush(dlqKey, JSON.stringify(job));
        await redis.hincrby(STATS_KEY, `dlq:${jobType}`, 1).catch((error: unknown) => { console.error('[JobQueue] DLQ stats increment failed:', error); });
        return;
      }
    } catch (error) {
      console.error('[JobQueue] Redis DLQ push failed, falling through to memory:', error);
    }
  }

  if (!dlqMemory.has(dlqKey)) {
    dlqMemory.set(dlqKey, []);
  }
  dlqMemory.get(dlqKey)!.push(job);
}

// ---------------------------------------------------------------------------
// Stats & monitoring
// ---------------------------------------------------------------------------

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<Record<string, unknown>> {
  if (isRedisAvailable()) {
    try {
      const redis = await getRedisClient();
      if (redis) {
        const stats = await redis.hgetall(STATS_KEY);
        return {
          ...stats,
          backend: 'redis',
        };
      }
    } catch (error) {
      console.error('[JobQueue] Redis stats retrieval failed, falling through to memory:', error);
    }
  }

  // Memory stats
  const stats: Record<string, number> = {};
  for (const [key, queue] of memoryQueues.entries()) {
    stats[`pending:${key}`] = queue.length;
  }
  for (const [key, queue] of dlqMemory.entries()) {
    stats[`dlq:${key}`] = queue.length;
  }
  return { ...stats, backend: 'memory' };
}

/**
 * Get dead letter queue entries for a job type
 */
export async function getDLQEntries(jobType: string, limit = 20): Promise<Job[]> {
  const dlqKey = `${DLQ_PREFIX}${jobType}`;

  // Memory fallback only for now
  const queue = dlqMemory.get(dlqKey) || [];
  return queue.slice(0, limit);
}

/**
 * Get queue length for a specific job type
 */
export async function getQueueLength(jobType: string): Promise<number> {
  let total = 0;
  const priorities = ['critical', 'high', 'normal', 'low'];

  for (const priority of priorities) {
    const queueKey = `${QUEUE_PREFIX}${priority}:${jobType}`;

    if (isRedisAvailable()) {
      try {
        const redis = await getRedisClient();
        if (redis) {
          total += await redis.llen(queueKey);
          continue;
        }
      } catch (error) {
        console.error('[JobQueue] Redis queue length check failed, falling through:', error);
      }
    }

    const queue = memoryQueues.get(queueKey);
    if (queue) total += queue.length;
  }

  return total;
}

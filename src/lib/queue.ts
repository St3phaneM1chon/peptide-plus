/**
 * BULLMQ QUEUE INFRASTRUCTURE
 *
 * Factory functions for creating BullMQ queues and workers.
 * Uses the existing ioredis connection from redis.ts.
 *
 * Gracefully degrades when Redis is unavailable — all functions
 * return null or log warnings rather than throwing.
 *
 * Usage:
 *   import { createQueue, createWorker, scheduleRepeatingJob } from '@/lib/queue';
 *
 *   const queue = createQueue('media-cleanup');
 *   const worker = createWorker('media-cleanup', async (job) => { ... });
 *   await scheduleRepeatingJob('media-cleanup', '0 3 * * *');
 */

import { Queue, Worker, Job, type ConnectionOptions } from 'bullmq';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Queue name constants — matching existing cron job route names
// ---------------------------------------------------------------------------

export const QUEUE_NAMES = {
  // Inventory & Products
  LOW_STOCK_ALERTS: 'low-stock-alerts',
  STOCK_ALERTS: 'stock-alerts',
  RELEASE_RESERVATIONS: 'release-reservations',
  REPLENISHMENT_REMINDER: 'replenishment-reminder',

  // Pricing & Currency
  FX_RATE_SYNC: 'fx-rate-sync',
  UPDATE_EXCHANGE_RATES: 'update-exchange-rates',
  PRICE_DROP_ALERTS: 'price-drop-alerts',

  // Email & Notifications
  ABANDONED_CART: 'abandoned-cart',
  BIRTHDAY_BONUS: 'birthday-bonus',
  BIRTHDAY_EMAILS: 'birthday-emails',
  BROWSE_ABANDONMENT: 'browse-abandonment',
  EMAIL_FLOWS: 'email-flows',
  SATISFACTION_SURVEY: 'satisfaction-survey',
  WELCOME_SERIES: 'welcome-series',
  SCHEDULED_CAMPAIGNS: 'scheduled-campaigns',
  CHURN_ALERTS: 'churn-alerts',
  POINTS_EXPIRING: 'points-expiring',

  // Analytics & Metrics
  CALCULATE_AGENT_STATS: 'calculate-agent-stats',
  CALCULATE_METRICS: 'calculate-metrics',
  LEAD_SCORING: 'lead-scoring',
  AB_TEST_CHECK: 'ab-test-check',

  // Media & Data
  MEDIA_CLEANUP: 'media-cleanup',
  DATA_RETENTION: 'data-retention',
  SYNC_EMAIL_TRACKING: 'sync-email-tracking',

  // VoIP
  VOIP_NOTIFICATIONS: 'voip-notifications',
  VOIP_RECORDINGS: 'voip-recordings',
  VOIP_TRANSCRIPTIONS: 'voip-transcriptions',

  // Reports & Finance
  SCHEDULED_REPORTS: 'scheduled-reports',
  REVENUE_RECOGNITION: 'revenue-recognition',
  AGING_REMINDERS: 'aging-reminders',

  // System
  DEPENDENCY_CHECK: 'dependency-check',
  DEAL_ROTTING: 'deal-rotting',
  PROCESS_CALLBACKS: 'process-callbacks',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// FIX A9-P0-001: Only these queues have registered processors in queue-registry.ts.
// The other 32 queues are cron HTTP routes — NOT BullMQ workers.
// This prevents creating dead Redis queue instances and makes the admin dashboard honest.
export const ACTIVE_QUEUE_NAMES = new Set<string>([
  QUEUE_NAMES.MEDIA_CLEANUP,
]);

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

/** BullMQ key prefix to avoid collisions with other Redis keys */
const BULLMQ_PREFIX = 'bull';

/**
 * Build the ioredis-compatible connection options that BullMQ expects.
 * BullMQ internally creates its own ioredis connections, so we pass
 * the raw URL + settings rather than a pre-existing client instance.
 */
function getConnectionOpts(): ConnectionOptions | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.debug('[queue] REDIS_URL not set — BullMQ unavailable');
    return null;
  }

  // Parse the URL into host/port/password/db that BullMQ's ioredis accepts
  try {
    const parsed = new URL(redisUrl);
    const opts: ConnectionOptions = {
      host: parsed.hostname || '127.0.0.1',
      port: parseInt(parsed.port, 10) || 6379,
      maxRetriesPerRequest: null, // Required by BullMQ
    };

    if (parsed.password) {
      opts.password = decodeURIComponent(parsed.password);
    }
    if (parsed.username && parsed.username !== 'default') {
      opts.username = decodeURIComponent(parsed.username);
    }
    const dbMatch = parsed.pathname.match(/\/(\d+)/);
    if (dbMatch) {
      opts.db = parseInt(dbMatch[1], 10);
    }

    // TLS support for Azure Redis or other managed services
    if (parsed.protocol === 'rediss:') {
      opts.tls = {};
    }

    return opts;
  } catch (err) {
    logger.error('[queue] Failed to parse REDIS_URL', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Queue factory
// ---------------------------------------------------------------------------

/** Cache of created queues to avoid duplicates */
const _queues = new Map<string, Queue>();

/**
 * Create (or retrieve from cache) a named BullMQ Queue.
 * Returns null when Redis is unavailable.
 */
export function createQueue(name: string): Queue | null {
  // Return cached instance if we already created this queue
  const existing = _queues.get(name);
  if (existing) return existing;

  const connection = getConnectionOpts();
  if (!connection) return null;

  try {
    const queue = new Queue(name, {
      connection,
      prefix: BULLMQ_PREFIX,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 7 * 24 * 3600, // Keep completed jobs for 7 days
          count: 1000,        // Keep last 1000 completed jobs max
        },
        removeOnFail: {
          count: 1000,          // Keep last 1000 failed jobs (DLQ equivalent)
          age: 30 * 24 * 3600,  // Keep failed jobs for 30 days
        },
      },
    });

    _queues.set(name, queue);
    logger.debug('[queue] Queue created', { name });
    return queue;
  } catch (err) {
    logger.error('[queue] Failed to create queue', {
      name,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Worker factory
// ---------------------------------------------------------------------------

/** Cache of created workers to avoid duplicates */
const _workers = new Map<string, Worker>();

/**
 * Create (or retrieve from cache) a BullMQ Worker for the given queue name.
 * The processor function receives a Job and must return a Promise<void>.
 *
 * Returns null when Redis is unavailable.
 */
export function createWorker(
  name: string,
  processor: (job: Job) => Promise<void>,
  opts?: { concurrency?: number }
): Worker | null {
  const existing = _workers.get(name);
  if (existing) return existing;

  const connection = getConnectionOpts();
  if (!connection) return null;

  try {
    const worker = new Worker(name, processor, {
      connection,
      prefix: BULLMQ_PREFIX,
      concurrency: opts?.concurrency ?? 1,
      // Stall-check interval (ms) — how quickly we detect a stalled job
      stalledInterval: 30_000,
      // If a job runs longer than 5 minutes, consider it stalled
      lockDuration: 5 * 60_000,
    });

    // Event handlers
    worker.on('completed', (job: Job) => {
      logger.info('[queue] Job completed', {
        queue: name,
        jobId: job.id,
        duration: job.finishedOn && job.processedOn
          ? `${job.finishedOn - job.processedOn}ms`
          : 'unknown',
      });
    });

    worker.on('failed', (job: Job | undefined, err: Error) => {
      const attemptsMade = job?.attemptsMade ?? 0;
      const maxAttempts = (job?.opts?.attempts as number) ?? 3;
      const isDeadLettered = attemptsMade >= maxAttempts;

      if (isDeadLettered) {
        // All retries exhausted — job moves to "failed" state (DLQ equivalent).
        // These remain queryable via getQueueStats().failed and the admin dashboard.
        logger.error('[queue] Job dead-lettered (all retries exhausted)', {
          queue: name,
          jobId: job?.id,
          attempts: attemptsMade,
          maxAttempts,
          error: err.message,
          data: job?.data,
        });
      } else {
        logger.warn('[queue] Job failed (will retry)', {
          queue: name,
          jobId: job?.id,
          attempt: attemptsMade,
          maxAttempts,
          error: err.message,
        });
      }
    });

    worker.on('error', (err: Error) => {
      logger.error('[queue] Worker error', {
        queue: name,
        error: err.message,
      });
    });

    _workers.set(name, worker);
    logger.info('[queue] Worker started', { name, concurrency: opts?.concurrency ?? 1 });
    return worker;
  } catch (err) {
    logger.error('[queue] Failed to create worker', {
      name,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Scheduling helpers
// ---------------------------------------------------------------------------

/**
 * Schedule a repeatable job using a cron expression.
 * If a repeatable job with the same pattern already exists, BullMQ deduplicates it.
 *
 * @param queueName - Name of the queue (must match a QUEUE_NAMES value)
 * @param cronExpression - Standard 5-field cron expression (e.g. "0 3 * * *")
 * @param data - Optional data payload to pass to the job processor
 * @returns true if scheduled successfully, false otherwise
 */
export async function scheduleRepeatingJob(
  queueName: string,
  cronExpression: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  const queue = createQueue(queueName);
  if (!queue) {
    logger.warn('[queue] Cannot schedule repeating job — queue unavailable', { queueName });
    return false;
  }

  try {
    await queue.add(
      `${queueName}-repeat`,
      data ?? {},
      {
        repeat: {
          pattern: cronExpression,
        },
      }
    );
    logger.info('[queue] Repeating job scheduled', { queueName, cron: cronExpression });
    return true;
  } catch (err) {
    logger.error('[queue] Failed to schedule repeating job', {
      queueName,
      cron: cronExpression,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Add a one-off job to a queue.
 *
 * @param queueName - Name of the queue
 * @param data - Job payload
 * @param opts - Optional: delay (ms), priority, jobId
 * @returns The Job instance, or null if the queue is unavailable
 */
export async function addJob(
  queueName: string,
  data: Record<string, unknown>,
  opts?: { delay?: number; priority?: number; jobId?: string }
): Promise<Job | null> {
  const queue = createQueue(queueName);
  if (!queue) {
    logger.warn('[queue] Cannot add job — queue unavailable', { queueName });
    return null;
  }

  try {
    const job = await queue.add(queueName, data, {
      delay: opts?.delay,
      priority: opts?.priority,
      jobId: opts?.jobId,
    });
    logger.debug('[queue] Job added', { queueName, jobId: job.id });
    return job;
  } catch (err) {
    logger.error('[queue] Failed to add job', {
      queueName,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Queue info helpers (for admin dashboard)
// ---------------------------------------------------------------------------

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

/**
 * Get stats for a specific queue.
 */
export async function getQueueStats(name: string): Promise<QueueStats | null> {
  const queue = createQueue(name);
  if (!queue) return null;

  try {
    const counts = await queue.getJobCounts(
      'waiting', 'active', 'completed', 'failed', 'delayed', 'paused'
    );

    return {
      name,
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: counts.paused ?? 0,
    };
  } catch (err) {
    logger.error('[queue] Failed to get queue stats', {
      name,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Get stats for all known queues.
 * FIX A9-P0-001: Only creates Redis connections for active queues (those with processors).
 * Pass activeOnly=false to include all 33 queues (for admin overview).
 */
export async function getAllQueueStats(activeOnly = true): Promise<QueueStats[]> {
  const names = activeOnly
    ? Array.from(ACTIVE_QUEUE_NAMES)
    : Object.values(QUEUE_NAMES);
  const results = await Promise.allSettled(
    names.map((name) => getQueueStats(name))
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<QueueStats | null> => r.status === 'fulfilled'
    )
    .map((r) => r.value)
    .filter((s): s is QueueStats => s !== null);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Gracefully shut down all queues and workers.
 * Call this on process exit / during tests.
 */
export async function closeAllQueues(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  for (const [name, worker] of _workers) {
    logger.debug('[queue] Closing worker', { name });
    closePromises.push(worker.close());
  }
  for (const [name, queue] of _queues) {
    logger.debug('[queue] Closing queue', { name });
    closePromises.push(queue.close());
  }

  await Promise.allSettled(closePromises);
  _workers.clear();
  _queues.clear();
}

export { Job };

/**
 * DEAD LETTER QUEUE (DLQ) SERVICE
 *
 * Provides a dedicated BullMQ queue for jobs that have exhausted all retries.
 * When a worker detects a dead-lettered job (attemptsMade >= maxAttempts),
 * it copies the job data here for investigation, manual retry, or purging.
 *
 * The DLQ is a standard BullMQ queue named "dlq". Each DLQ job contains:
 *   - originalQueue: the queue name the job came from
 *   - originalJobId: the original job ID
 *   - originalData: the original job payload
 *   - failedReason: the error message from the last attempt
 *   - attemptsMade: how many times the job was tried
 *   - deadLetteredAt: ISO timestamp of when it was moved to DLQ
 *
 * Admin endpoints consume this module to list/retry/purge DLQ items.
 *
 * Usage:
 *   import { moveToDeadLetterQueue, getDlqJobs, retryDlqJob, purgeDlq } from '@/lib/queue/dlq';
 */

import type { Job } from 'bullmq';
import { createQueue, addJob, ACTIVE_QUEUE_NAMES } from '@/lib/queue';
import { queueProcessors } from '@/lib/queue-registry';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Name of the Dead Letter Queue */
export const DLQ_NAME = 'dlq';

/** Maximum DLQ items to return in a single list request */
export const DLQ_MAX_PAGE_SIZE = 100;

/** Default page size for listing DLQ items */
export const DLQ_DEFAULT_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// DLQ Job Data Interface
// ---------------------------------------------------------------------------

export interface DlqJobData {
  originalQueue: string;
  originalJobId: string | undefined;
  originalJobName: string | undefined;
  originalData: Record<string, unknown>;
  failedReason: string;
  attemptsMade: number;
  maxAttempts: number;
  stackTrace: string | undefined;
  deadLetteredAt: string;
}

export interface DlqJobInfo {
  dlqJobId: string | undefined;
  originalQueue: string;
  originalJobId: string | undefined;
  originalJobName: string | undefined;
  failedReason: string;
  attemptsMade: number;
  maxAttempts: number;
  deadLetteredAt: string;
  data: Record<string, unknown>;
  stackTrace: string | undefined;
}

// ---------------------------------------------------------------------------
// Move a failed job to the DLQ
// ---------------------------------------------------------------------------

/**
 * Copy a dead-lettered job's data into the dedicated DLQ queue.
 * Called from the worker's "failed" event handler when all retries
 * have been exhausted.
 *
 * This does NOT remove the original job from its queue -- BullMQ keeps
 * it in the "failed" state per the removeOnFail settings. The DLQ entry
 * is an additional record for admin visibility and retry capability.
 */
export async function moveToDeadLetterQueue(
  originalQueueName: string,
  job: Job | undefined,
  error: Error
): Promise<boolean> {
  if (!job) {
    logger.warn('[dlq] Cannot move undefined job to DLQ', { originalQueueName });
    return false;
  }

  const dlqData: DlqJobData = {
    originalQueue: originalQueueName,
    originalJobId: job.id,
    originalJobName: job.name,
    originalData: job.data ?? {},
    failedReason: error.message,
    attemptsMade: job.attemptsMade ?? 0,
    maxAttempts: (job.opts?.attempts as number) ?? 3,
    stackTrace: error.stack,
    deadLetteredAt: new Date().toISOString(),
  };

  const dlqJob = await addJob(DLQ_NAME, dlqData as unknown as Record<string, unknown>, {
    // Use a descriptive jobId to aid debugging
    jobId: `dlq-${originalQueueName}-${job.id ?? Date.now()}`,
  });

  if (dlqJob) {
    logger.info('[dlq] Job moved to DLQ', {
      originalQueue: originalQueueName,
      originalJobId: job.id,
      dlqJobId: dlqJob.id,
      failedReason: error.message,
    });
    return true;
  }

  logger.error('[dlq] Failed to move job to DLQ (queue unavailable)', {
    originalQueue: originalQueueName,
    originalJobId: job.id,
  });
  return false;
}

// ---------------------------------------------------------------------------
// List DLQ jobs
// ---------------------------------------------------------------------------

/**
 * List jobs currently in the DLQ.
 * Returns jobs in the "waiting" state (DLQ has no worker processing them).
 *
 * @param offset - Start index (default 0)
 * @param limit - Max items to return (default 50, max 100)
 */
export async function getDlqJobs(
  offset = 0,
  limit = DLQ_DEFAULT_PAGE_SIZE
): Promise<{ jobs: DlqJobInfo[]; total: number }> {
  const queue = createQueue(DLQ_NAME);
  if (!queue) {
    return { jobs: [], total: 0 };
  }

  const safeLimit = Math.min(Math.max(1, limit), DLQ_MAX_PAGE_SIZE);

  try {
    // DLQ jobs sit in "waiting" since there's no worker consuming them.
    // Also check "delayed" and "failed" in case addJob used delay or the job errored.
    const counts = await queue.getJobCounts('waiting', 'delayed', 'failed');
    const total = (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.failed ?? 0);

    const jobs = await queue.getJobs(
      ['waiting', 'delayed', 'failed'],
      offset,
      offset + safeLimit - 1
    );

    const dlqJobs: DlqJobInfo[] = jobs.map((job) => {
      const data = job.data as DlqJobData;
      return {
        dlqJobId: job.id,
        originalQueue: data.originalQueue ?? 'unknown',
        originalJobId: data.originalJobId,
        originalJobName: data.originalJobName,
        failedReason: data.failedReason ?? 'unknown',
        attemptsMade: data.attemptsMade ?? 0,
        maxAttempts: data.maxAttempts ?? 3,
        deadLetteredAt: data.deadLetteredAt ?? job.timestamp
          ? new Date(job.timestamp).toISOString()
          : 'unknown',
        data: data.originalData ?? {},
        stackTrace: data.stackTrace,
      };
    });

    return { jobs: dlqJobs, total };
  } catch (err) {
    logger.error('[dlq] Failed to list DLQ jobs', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { jobs: [], total: 0 };
  }
}

// ---------------------------------------------------------------------------
// Retry a DLQ job
// ---------------------------------------------------------------------------

/**
 * Retry a specific DLQ job by re-adding it to its original queue.
 *
 * Steps:
 * 1. Fetch the DLQ job by ID
 * 2. Extract the original queue name and job data
 * 3. Add a new job to the original queue with the original data
 * 4. Remove the DLQ entry
 *
 * @param dlqJobId - The ID of the DLQ job to retry
 * @returns Object with success status and details
 */
export async function retryDlqJob(
  dlqJobId: string
): Promise<{ success: boolean; message: string; newJobId?: string }> {
  const queue = createQueue(DLQ_NAME);
  if (!queue) {
    return { success: false, message: 'DLQ unavailable (Redis not connected)' };
  }

  try {
    const job = await queue.getJob(dlqJobId);
    if (!job) {
      return { success: false, message: `DLQ job not found: ${dlqJobId}` };
    }

    const data = job.data as DlqJobData;
    const originalQueueName = data.originalQueue;

    if (!originalQueueName) {
      return { success: false, message: 'DLQ job missing originalQueue field' };
    }

    // Verify the original queue has a registered processor
    if (!(originalQueueName in queueProcessors) && !ACTIVE_QUEUE_NAMES.has(originalQueueName)) {
      return {
        success: false,
        message: `No processor registered for original queue "${originalQueueName}". Retry would be pointless.`,
      };
    }

    // Re-add the job to the original queue
    const retryData = {
      ...data.originalData,
      _retriedFromDlq: true,
      _dlqJobId: dlqJobId,
      _retriedAt: new Date().toISOString(),
    };

    const newJob = await addJob(originalQueueName, retryData);
    if (!newJob) {
      return {
        success: false,
        message: `Failed to add retry job to queue "${originalQueueName}" (queue unavailable)`,
      };
    }

    // Remove the DLQ entry after successful retry
    await job.remove();

    logger.info('[dlq] Job retried from DLQ', {
      dlqJobId,
      originalQueue: originalQueueName,
      originalJobId: data.originalJobId,
      newJobId: newJob.id,
    });

    return {
      success: true,
      message: `Job re-queued to "${originalQueueName}"`,
      newJobId: newJob.id,
    };
  } catch (err) {
    logger.error('[dlq] Failed to retry DLQ job', {
      dlqJobId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      message: `Failed to retry: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Retry all DLQ jobs for a specific queue
// ---------------------------------------------------------------------------

/**
 * Retry all DLQ jobs that originated from a specific queue.
 */
export async function retryAllDlqJobsForQueue(
  originalQueueName: string
): Promise<{ success: boolean; retried: number; failed: number }> {
  const { jobs } = await getDlqJobs(0, DLQ_MAX_PAGE_SIZE);
  const matching = jobs.filter((j) => j.originalQueue === originalQueueName);

  let retried = 0;
  let failed = 0;

  for (const job of matching) {
    if (job.dlqJobId) {
      const result = await retryDlqJob(job.dlqJobId);
      if (result.success) {
        retried++;
      } else {
        failed++;
      }
    } else {
      failed++;
    }
  }

  return { success: failed === 0, retried, failed };
}

// ---------------------------------------------------------------------------
// Purge DLQ
// ---------------------------------------------------------------------------

/**
 * Remove all jobs from the DLQ.
 *
 * @param originalQueueFilter - Optional: only purge DLQ jobs from a specific original queue
 * @returns Number of jobs purged
 */
export async function purgeDlq(originalQueueFilter?: string): Promise<number> {
  const queue = createQueue(DLQ_NAME);
  if (!queue) {
    return 0;
  }

  try {
    const jobs = await queue.getJobs(['waiting', 'delayed', 'failed'], 0, 10000);

    let toPurge = jobs;
    if (originalQueueFilter) {
      toPurge = jobs.filter(
        (j) => (j.data as DlqJobData).originalQueue === originalQueueFilter
      );
    }

    const results = await Promise.allSettled(toPurge.map((j) => j.remove()));
    const purged = results.filter((r) => r.status === 'fulfilled').length;

    logger.info('[dlq] DLQ purged', {
      purged,
      filter: originalQueueFilter ?? 'all',
    });

    return purged;
  } catch (err) {
    logger.error('[dlq] Failed to purge DLQ', {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

// ---------------------------------------------------------------------------
// DLQ Stats
// ---------------------------------------------------------------------------

/**
 * Get a summary of DLQ contents, grouped by original queue.
 */
export async function getDlqStats(): Promise<{
  total: number;
  byQueue: Record<string, number>;
  oldest: string | null;
  newest: string | null;
}> {
  const { jobs, total } = await getDlqJobs(0, DLQ_MAX_PAGE_SIZE);

  const byQueue: Record<string, number> = {};
  let oldest: string | null = null;
  let newest: string | null = null;

  for (const job of jobs) {
    const qName = job.originalQueue ?? 'unknown';
    byQueue[qName] = (byQueue[qName] ?? 0) + 1;

    if (job.deadLetteredAt && job.deadLetteredAt !== 'unknown') {
      if (!oldest || job.deadLetteredAt < oldest) oldest = job.deadLetteredAt;
      if (!newest || job.deadLetteredAt > newest) newest = job.deadLetteredAt;
    }
  }

  return { total, byQueue, oldest, newest };
}

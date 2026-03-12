export const dynamic = 'force-dynamic';

/**
 * Dead Letter Queue (DLQ) Admin Endpoints
 *
 * GET    /api/admin/queues/dlq         — List DLQ jobs (with pagination & filtering)
 * POST   /api/admin/queues/dlq/retry   — Retry a specific DLQ job (via body: { dlqJobId })
 * DELETE /api/admin/queues/dlq/purge   — Purge DLQ (optionally filtered by original queue)
 *
 * Since Next.js App Router requires POST/DELETE to be in the same route.ts,
 * we use the request body / query params to distinguish retry vs purge actions.
 *
 * POST body: { action: "retry", dlqJobId: "..." }
 *         or { action: "retryAll", originalQueue: "..." }
 * DELETE query: ?queue=<originalQueue> (optional filter)
 *
 * Authentication: Admin guard (EMPLOYEE or OWNER role required).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { isRedisAvailable } from '@/lib/redis';
import { logger } from '@/lib/logger';
import {
  getDlqJobs,
  getDlqStats,
  retryDlqJob,
  retryAllDlqJobsForQueue,
  purgeDlq,
  DLQ_MAX_PAGE_SIZE,
  DLQ_DEFAULT_PAGE_SIZE,
} from '@/lib/queue/dlq';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const retryOneSchema = z.object({
  action: z.literal('retry'),
  dlqJobId: z.string().min(1, 'dlqJobId is required'),
});

const retryAllSchema = z.object({
  action: z.literal('retryAll'),
  originalQueue: z.string().min(1, 'originalQueue is required'),
});

const postBodySchema = z.discriminatedUnion('action', [retryOneSchema, retryAllSchema]);

// ---------------------------------------------------------------------------
// GET — List DLQ jobs with stats
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    if (!isRedisAvailable() && !process.env.REDIS_URL) {
      return NextResponse.json({
        available: false,
        message: 'Redis is not configured. DLQ is unavailable.',
        stats: null,
        jobs: [],
      });
    }

    const url = new URL(request.url);
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10) || 0);
    const limit = Math.min(
      DLQ_MAX_PAGE_SIZE,
      Math.max(1, parseInt(url.searchParams.get('limit') ?? String(DLQ_DEFAULT_PAGE_SIZE), 10) || DLQ_DEFAULT_PAGE_SIZE)
    );
    const queueFilter = url.searchParams.get('queue') || undefined;
    const includeStackTrace = url.searchParams.get('stacktrace') === 'true';

    // Fetch stats and jobs in parallel
    const [stats, { jobs, total }] = await Promise.all([
      getDlqStats(),
      getDlqJobs(offset, limit),
    ]);

    // Optional: filter by original queue
    let filteredJobs = jobs;
    let filteredTotal = total;
    if (queueFilter) {
      filteredJobs = jobs.filter((j) => j.originalQueue === queueFilter);
      filteredTotal = stats.byQueue[queueFilter] ?? 0;
    }

    // Strip stack traces unless explicitly requested (they can be large)
    const responseJobs = filteredJobs.map((job) => {
      const { stackTrace, ...rest } = job;
      return includeStackTrace ? job : rest;
    });

    return NextResponse.json({
      available: true,
      stats,
      pagination: {
        offset,
        limit,
        total: filteredTotal,
        hasMore: offset + limit < filteredTotal,
      },
      filter: queueFilter ?? null,
      jobs: responseJobs,
    });
  } catch (error) {
    logger.error('[admin/queues/dlq] GET failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to retrieve DLQ jobs' },
      { status: 500 }
    );
  }
}, { skipCsrf: true });

// ---------------------------------------------------------------------------
// POST — Retry DLQ jobs
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    if (!isRedisAvailable() && !process.env.REDIS_URL) {
      return NextResponse.json(
        { error: 'Redis is not configured. DLQ is unavailable.' },
        { status: 503 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body. Expected: { action: "retry", dlqJobId: "..." } or { action: "retryAll", originalQueue: "..." }' },
        { status: 400 }
      );
    }

    const parsed = postBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
          expected: [
            '{ action: "retry", dlqJobId: "job-id" }',
            '{ action: "retryAll", originalQueue: "queue-name" }',
          ],
        },
        { status: 400 }
      );
    }

    if (parsed.data.action === 'retry') {
      const result = await retryDlqJob(parsed.data.dlqJobId);

      logger.info('[admin/queues/dlq] Retry single job', {
        dlqJobId: parsed.data.dlqJobId,
        success: result.success,
      });

      return NextResponse.json(result, {
        status: result.success ? 200 : 400,
      });
    }

    if (parsed.data.action === 'retryAll') {
      const result = await retryAllDlqJobsForQueue(parsed.data.originalQueue);

      logger.info('[admin/queues/dlq] Retry all jobs for queue', {
        originalQueue: parsed.data.originalQueue,
        retried: result.retried,
        failed: result.failed,
      });

      return NextResponse.json({
        success: result.success,
        message: `Retried ${result.retried} jobs from queue "${parsed.data.originalQueue}"${result.failed > 0 ? ` (${result.failed} failed)` : ''}`,
        retried: result.retried,
        failed: result.failed,
      });
    }

    // Should not reach here due to discriminated union, but TypeScript needs it
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    logger.error('[admin/queues/dlq] POST failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to retry DLQ job' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE — Purge DLQ
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (request: NextRequest) => {
  try {
    if (!isRedisAvailable() && !process.env.REDIS_URL) {
      return NextResponse.json(
        { error: 'Redis is not configured. DLQ is unavailable.' },
        { status: 503 }
      );
    }

    const url = new URL(request.url);
    const queueFilter = url.searchParams.get('queue') || undefined;

    const purged = await purgeDlq(queueFilter);

    logger.info('[admin/queues/dlq] Purge DLQ', {
      purged,
      filter: queueFilter ?? 'all',
    });

    return NextResponse.json({
      success: true,
      purged,
      filter: queueFilter ?? 'all',
      message: queueFilter
        ? `Purged ${purged} DLQ jobs from queue "${queueFilter}"`
        : `Purged ${purged} DLQ jobs (all queues)`,
    });
  } catch (error) {
    logger.error('[admin/queues/dlq] DELETE failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to purge DLQ' },
      { status: 500 }
    );
  }
});

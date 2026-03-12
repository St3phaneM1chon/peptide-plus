export const dynamic = 'force-dynamic';

/**
 * Queue Management Endpoints
 *
 * GET    /api/admin/queues/[name] — Queue details + recent jobs
 * POST   /api/admin/queues/[name] — Manually trigger a job
 * DELETE /api/admin/queues/[name] — Clean completed/failed jobs
 *
 * Authentication: Admin guard (EMPLOYEE or OWNER role required).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { createQueue, getQueueStats, addJob, QUEUE_NAMES } from '@/lib/queue';
import { queueProcessors } from '@/lib/queue-registry';
import { logger } from '@/lib/logger';

const triggerJobSchema = z.record(z.string(), z.unknown()).optional().default({});

// Validate that the queue name is one we know about
const validQueueNames = new Set(Object.values(QUEUE_NAMES));

// ---------------------------------------------------------------------------
// GET — Queue details + recent jobs
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (
  _request: NextRequest,
  { params }: { params: { name: string } }
) => {
  const name = params.name;

  if (!validQueueNames.has(name as typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES])) {
    return NextResponse.json(
      { error: `Unknown queue: ${name}` },
      { status: 404 }
    );
  }

  try {
    const stats = await getQueueStats(name);
    if (!stats) {
      return NextResponse.json(
        { error: 'Queue unavailable (Redis not connected)' },
        { status: 503 }
      );
    }

    // Fetch recent jobs
    const queue = createQueue(name);
    let recentJobs: Array<Record<string, unknown>> = [];

    if (queue) {
      const [completed, failed, waiting, active] = await Promise.all([
        queue.getJobs(['completed'], 0, 10),
        queue.getJobs(['failed'], 0, 10),
        queue.getJobs(['waiting'], 0, 10),
        queue.getJobs(['active'], 0, 5),
      ]);

      const allJobs = [...active, ...waiting, ...completed, ...failed]
        .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
        .slice(0, 20);

      recentJobs = allJobs.map((job) => ({
        id: job.id,
        name: job.name,
        status: job.finishedOn
          ? job.failedReason
            ? 'failed'
            : 'completed'
          : job.processedOn
            ? 'active'
            : 'waiting',
        data: job.data,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason || null,
        createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
        processedAt: job.processedOn ? new Date(job.processedOn).toISOString() : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
        duration: job.finishedOn && job.processedOn
          ? `${job.finishedOn - job.processedOn}ms`
          : null,
      }));
    }

    // Check if this queue has a registered processor
    const hasProcessor = name in queueProcessors;

    // Get repeatable jobs
    let repeatableJobs: Array<Record<string, unknown>> = [];
    if (queue) {
      try {
        const repeatable = await queue.getRepeatableJobs();
        repeatableJobs = repeatable.map((r) => ({
          key: r.key,
          name: r.name,
          cron: r.pattern,
          next: r.next ? new Date(r.next).toISOString() : null,
        }));
      } catch {
        // Repeatable jobs may not be available
      }
    }

    return NextResponse.json({
      name,
      hasProcessor,
      stats,
      repeatableJobs,
      recentJobs,
    });
  } catch (error) {
    logger.error('[admin/queues] Failed to get queue details', {
      queue: name,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to retrieve queue details' },
      { status: 500 }
    );
  }
}, { skipCsrf: true });

// ---------------------------------------------------------------------------
// POST — Manually trigger a job
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (
  request: NextRequest,
  { params }: { params: { name: string } }
) => {
  const name = params.name;

  if (!validQueueNames.has(name as typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES])) {
    return NextResponse.json(
      { error: `Unknown queue: ${name}` },
      { status: 404 }
    );
  }

  // Check that a processor is registered for this queue
  if (!(name in queueProcessors)) {
    return NextResponse.json(
      { error: `No processor registered for queue "${name}". The job would never be processed.` },
      { status: 400 }
    );
  }

  try {
    let data: Record<string, unknown> = {};
    try {
      const body = await request.json();
      const parsed = triggerJobSchema.safeParse(body);
      if (parsed.success && parsed.data) {
        data = parsed.data;
      }
    } catch {
      // No body or invalid JSON — use empty data
    }

    // Add trigger metadata
    data._triggeredManually = true;
    data._triggeredAt = new Date().toISOString();

    const job = await addJob(name, data);

    if (!job) {
      return NextResponse.json(
        { error: 'Failed to add job — queue unavailable (Redis not connected)' },
        { status: 503 }
      );
    }

    logger.info('[admin/queues] Manual job triggered', {
      queue: name,
      jobId: job.id,
    });

    return NextResponse.json(
      {
        success: true,
        jobId: job.id,
        queue: name,
        message: `Job added to queue "${name}"`,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('[admin/queues] Failed to trigger job', {
      queue: name,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to trigger job' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE — Clean completed/failed jobs
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (
  request: NextRequest,
  { params }: { params: { name: string } }
) => {
  const name = params.name;

  if (!validQueueNames.has(name as typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES])) {
    return NextResponse.json(
      { error: `Unknown queue: ${name}` },
      { status: 404 }
    );
  }

  try {
    const queue = createQueue(name);
    if (!queue) {
      return NextResponse.json(
        { error: 'Queue unavailable (Redis not connected)' },
        { status: 503 }
      );
    }

    // Parse optional query params for what to clean
    const url = new URL(request.url);
    const cleanType = url.searchParams.get('type') || 'all'; // 'completed', 'failed', 'all'
    const graceMs = parseInt(url.searchParams.get('grace') || '0', 10); // Keep jobs newer than this (ms)

    let completedCleaned = 0;
    let failedCleaned = 0;

    if (cleanType === 'completed' || cleanType === 'all') {
      const completed = await queue.getJobs(['completed']);
      const toRemove = completed.filter(
        (j) => !graceMs || (j.finishedOn && Date.now() - j.finishedOn > graceMs)
      );
      await Promise.allSettled(toRemove.map((j) => j.remove()));
      completedCleaned = toRemove.length;
    }

    if (cleanType === 'failed' || cleanType === 'all') {
      const failed = await queue.getJobs(['failed']);
      const toRemove = failed.filter(
        (j) => !graceMs || (j.finishedOn && Date.now() - j.finishedOn > graceMs)
      );
      await Promise.allSettled(toRemove.map((j) => j.remove()));
      failedCleaned = toRemove.length;
    }

    logger.info('[admin/queues] Queue cleaned', {
      queue: name,
      cleanType,
      completedCleaned,
      failedCleaned,
    });

    return NextResponse.json({
      success: true,
      queue: name,
      cleaned: {
        completed: completedCleaned,
        failed: failedCleaned,
        total: completedCleaned + failedCleaned,
      },
    });
  } catch (error) {
    logger.error('[admin/queues] Failed to clean queue', {
      queue: name,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to clean queue' },
      { status: 500 }
    );
  }
});

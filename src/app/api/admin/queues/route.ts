export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/queues — List all BullMQ queues with stats
 *
 * Returns waiting, active, completed, failed, delayed, and paused counts
 * for every registered queue.
 *
 * Authentication: Admin guard (EMPLOYEE or OWNER role required).
 */

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getAllQueueStats, QUEUE_NAMES } from '@/lib/queue';
import { isRedisAvailable } from '@/lib/redis';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    // Check if Redis is available at all
    if (!isRedisAvailable() && !process.env.REDIS_URL) {
      return NextResponse.json({
        available: false,
        message: 'Redis is not configured (REDIS_URL not set). BullMQ queues are unavailable.',
        queues: [],
      });
    }

    const stats = await getAllQueueStats();

    // Compute aggregate summary
    const summary = {
      totalQueues: Object.keys(QUEUE_NAMES).length,
      activeQueues: stats.length,
      totalWaiting: stats.reduce((s, q) => s + q.waiting, 0),
      totalActive: stats.reduce((s, q) => s + q.active, 0),
      totalCompleted: stats.reduce((s, q) => s + q.completed, 0),
      totalFailed: stats.reduce((s, q) => s + q.failed, 0),
      totalDelayed: stats.reduce((s, q) => s + q.delayed, 0),
    };

    return NextResponse.json({
      available: true,
      summary,
      queues: stats,
    });
  } catch (error) {
    logger.error('[admin/queues] Failed to get queue stats', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to retrieve queue stats' },
      { status: 500 }
    );
  }
}, { skipCsrf: true });

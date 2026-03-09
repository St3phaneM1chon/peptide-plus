export const dynamic = 'force-dynamic';

/**
 * CRM Wallboard API
 * GET /api/admin/crm/wallboard - Real-time wallboard data (agents, calls, queues)
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess } from '@/lib/api-response';

// ---------------------------------------------------------------------------
// GET: Real-time wallboard data
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const now = new Date();

  // Today start (midnight UTC)
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // 5 minutes ago (for queue stats)
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

  // Run all queries in parallel
  const [
    agentsOnlineCount,
    agentsInCallCount,
    callsToday,
    completedCallsToday,
    ringingCallsRecent,
  ] = await Promise.all([
    // Agents with status ONLINE or BUSY
    prisma.presenceStatus.count({
      where: { status: { in: ['ONLINE', 'BUSY'] } },
    }),

    // Agents with status BUSY (in call)
    prisma.presenceStatus.count({
      where: { status: 'BUSY' },
    }),

    // All calls started today
    prisma.callLog.findMany({
      where: { startedAt: { gte: todayStart } },
      select: {
        id: true,
        status: true,
        duration: true,
        queue: true,
      },
    }),

    // Completed calls today (for avg talk time)
    prisma.callLog.findMany({
      where: {
        startedAt: { gte: todayStart },
        status: 'COMPLETED',
        duration: { not: null },
      },
      select: { duration: true },
    }),

    // Ringing calls in last 5 min (queue waiting)
    prisma.callLog.findMany({
      where: {
        status: 'RINGING',
        startedAt: { gte: fiveMinAgo },
        queue: { not: null },
      },
      select: { id: true, queue: true },
    }),
  ]);

  // Compute today stats
  const totalCalls = callsToday.length;
  const answered = callsToday.filter((c) => c.status === 'COMPLETED').length;
  const missed = callsToday.filter((c) => c.status === 'MISSED').length;
  const totalDuration = completedCallsToday.reduce((sum, c) => sum + (c.duration || 0), 0);
  const avgDuration = completedCallsToday.length > 0
    ? Math.round(totalDuration / completedCallsToday.length)
    : 0;

  // Compute avg talk time across all completed calls today (seconds)
  const avgTalkTime = avgDuration;

  // Build queue stats: group ringing calls by queue name
  const queueMap = new Map<string, { queueId: string; name: string; waitingCalls: number }>();
  for (const call of ringingCallsRecent) {
    const queueName = call.queue || 'unknown';
    const existing = queueMap.get(queueName);
    if (existing) {
      existing.waitingCalls++;
    } else {
      queueMap.set(queueName, {
        queueId: queueName,
        name: queueName,
        waitingCalls: 1,
      });
    }
  }

  return apiSuccess({
    agentsOnline: agentsOnlineCount,
    agentsInCall: agentsInCallCount,
    callsToday: totalCalls,
    avgTalkTime,
    todayStats: {
      totalCalls,
      answered,
      missed,
      avgDuration,
      totalDuration,
    },
    queueStats: Array.from(queueMap.values()),
  }, { request });
}, { requiredPermission: 'crm.reports.view' });

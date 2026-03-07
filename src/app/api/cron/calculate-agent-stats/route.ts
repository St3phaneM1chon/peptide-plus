export const dynamic = 'force-dynamic';

/**
 * CRON Job - Calculate Agent Daily Stats
 * GET /api/cron/calculate-agent-stats
 *
 * Aggregates call data from CallLog into AgentDailyStats for each agent
 * who had activity the previous day. Designed to run nightly.
 *
 * Protected by CRON_SECRET env var (Authorization: Bearer <CRON_SECRET>)
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization');
  const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

  try {
    const a = Buffer.from(cronSecret, 'utf8');
    const b = Buffer.from(providedSecret, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// GET: Aggregate agent stats for the previous day
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Calculate for yesterday by default (or a specific date via query param)
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    if (!dateParam) {
      targetDate.setDate(targetDate.getDate() - 1); // Yesterday
    }
    // Normalize to start/end of day (UTC)
    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // Fetch all call logs for the target day
    const callLogs = await prisma.callLog.findMany({
      where: {
        startedAt: { gte: dayStart, lte: dayEnd },
      },
      select: {
        id: true,
        agentId: true,
        direction: true,
        status: true,
        startedAt: true,
        endedAt: true,
        duration: true,
        waitTime: true,
      },
    });

    // Group by agent (agentId is SipExtension id, we need to map)
    const agentMap = new Map<string, typeof callLogs>();
    for (const log of callLogs) {
      if (!log.agentId) continue;
      const existing = agentMap.get(log.agentId) || [];
      existing.push(log);
      agentMap.set(log.agentId, existing);
    }

    const processed = agentMap.size;

    // Compute stats for all agents, then batch upsert in a single transaction
    const upsertOperations: Array<ReturnType<typeof prisma.agentDailyStats.upsert>> = [];

    for (const [agentId, logs] of agentMap) {
      const callsMade = logs.filter((l) => l.direction === 'OUTBOUND').length;
      const callsReceived = logs.filter((l) => l.direction === 'INBOUND').length;
      const callsAnswered = logs.filter(
        (l) => l.status === 'COMPLETED'
      ).length;

      let totalTalkTime = 0;
      let totalWrapTime = 0;
      for (const log of logs) {
        totalTalkTime += log.duration ?? 0;
        totalWrapTime += log.waitTime ?? 0;
      }

      const totalCalls = logs.length;
      const avgHandleTime = totalCalls > 0
        ? (totalTalkTime + totalWrapTime) / totalCalls
        : 0;
      const avgTalkTime = totalCalls > 0 ? totalTalkTime / totalCalls : 0;

      // Find earliest and latest call times as login/logout proxies
      const times = logs.map((l) => l.startedAt.getTime()).sort((a, b) => a - b);
      const loginTime = times.length > 0 ? new Date(times[0]) : dayStart;
      const logoutTime = times.length > 0 ? new Date(times[times.length - 1]) : null;

      const statsData = {
        callsMade,
        callsReceived,
        callsAnswered,
        totalTalkTime: Math.round(totalTalkTime),
        totalWrapTime: Math.round(totalWrapTime),
        avgHandleTime: Math.round(avgHandleTime * 100) / 100,
        avgTalkTime: Math.round(avgTalkTime * 100) / 100,
        conversions: 0,
        revenue: 0,
        loginTime,
        logoutTime,
        breakTime: 0,
      };

      upsertOperations.push(
        prisma.agentDailyStats.upsert({
          where: {
            agentId_date: { agentId, date: dayStart },
          },
          update: statsData,
          create: { agentId, date: dayStart, ...statsData },
        })
      );
    }

    // Execute all upserts in a single transaction instead of N sequential queries
    const upserted = upsertOperations.length;
    if (upsertOperations.length > 0) {
      await prisma.$transaction(upsertOperations);
    }

    return NextResponse.json({
      success: true,
      date: dayStart.toISOString().split('T')[0],
      agents: processed,
      upserted,
      callsProcessed: callLogs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

/**
 * Call Center Analytics API — C29
 * GET /api/admin/crm/call-analytics - Call center KPIs
 *
 * Computes key call center metrics from CallLog data:
 * - AHT (Average Handle Time)
 * - ASA (Average Speed of Answer)
 * - FCR (First Call Resolution)
 * - Abandon Rate
 * - Service Level %
 * - Occupancy Rate
 *
 * Query params:
 * - from: ISO date string (start of range)
 * - to: ISO date string (end of range)
 * - queue: optional queue name filter
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess } from '@/lib/api-response';

// ---------------------------------------------------------------------------
// GET: Call center KPIs
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);

  // Default date range: last 7 days
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : defaultFrom;
  const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : now;
  const queue = searchParams.get('queue') || undefined;

  // Build where clause
  const where: Record<string, unknown> = {
    startedAt: { gte: from, lte: to },
  };
  if (queue) {
    where.queue = queue;
  }

  // Fetch all calls in the range
  const [allCalls, , abandonedCalls, agentPresence] = await Promise.all([
    prisma.callLog.findMany({
      where,
      select: {
        id: true,
        status: true,
        direction: true,
        duration: true,
        queue: true,
        startedAt: true,
        answeredAt: true,
        endedAt: true,
        agentId: true,
        callerNumber: true,
      },
    }),

    // Completed calls (for AHT calculation)
    prisma.callLog.count({
      where: { ...where, status: 'COMPLETED', duration: { not: null } },
    }),

    // Abandoned/missed calls (MISSED in schema represents abandoned inbound calls)
    prisma.callLog.count({
      where: { ...where, status: 'MISSED' },
    }),

    // Agent presence count for occupancy
    prisma.presenceStatus.count({
      where: { status: { in: ['ONLINE', 'BUSY'] } },
    }),
  ]);

  const totalCalls = allCalls.length;
  const answeredCalls = allCalls.filter((c) => c.status === 'COMPLETED');
  const inboundCalls = allCalls.filter((c) => c.direction === 'INBOUND');
  const inboundAnswered = inboundCalls.filter((c) => c.status === 'COMPLETED');

  // ── AHT (Average Handle Time) ─────────────────────
  // Total talk time / number of completed calls (seconds)
  const totalTalkTime = answeredCalls.reduce((sum, c) => sum + (c.duration || 0), 0);
  const aht = answeredCalls.length > 0 ? Math.round(totalTalkTime / answeredCalls.length) : 0;

  // ── ASA (Average Speed of Answer) ──────────────────
  // Average time from call start to agent answer (seconds)
  let totalWaitTime = 0;
  let waitCount = 0;

  for (const call of answeredCalls) {
    if (call.startedAt && call.answeredAt) {
      const wait = (new Date(call.answeredAt).getTime() - new Date(call.startedAt).getTime()) / 1000;
      if (wait >= 0 && wait < 600) { // Sanity: max 10 min wait
        totalWaitTime += wait;
        waitCount++;
      }
    }
  }

  const asa = waitCount > 0 ? Math.round(totalWaitTime / waitCount) : 0;

  // ── FCR (First Call Resolution) ────────────────────
  // Percentage of unique callers who only called once and were resolved
  const callerMap = new Map<string, number>();
  for (const call of allCalls) {
    if (call.callerNumber) {
      callerMap.set(call.callerNumber, (callerMap.get(call.callerNumber) || 0) + 1);
    }
  }

  const uniqueCallers = callerMap.size;
  const singleCallCallers = Array.from(callerMap.values()).filter((count) => count === 1).length;
  const fcr = uniqueCallers > 0 ? Math.round((singleCallCallers / uniqueCallers) * 100) : 0;

  // ── Abandon Rate ───────────────────────────────────
  const abandonRate = totalCalls > 0
    ? Math.round((abandonedCalls / totalCalls) * 1000) / 10
    : 0;

  // ── Service Level ──────────────────────────────────
  // % of inbound calls answered within 20 seconds (industry standard)
  const SL_THRESHOLD = 20; // seconds
  let answeredWithinThreshold = 0;

  for (const call of inboundAnswered) {
    if (call.startedAt && call.answeredAt) {
      const wait = (new Date(call.answeredAt).getTime() - new Date(call.startedAt).getTime()) / 1000;
      if (wait <= SL_THRESHOLD) {
        answeredWithinThreshold++;
      }
    }
  }

  const serviceLevel = inboundCalls.length > 0
    ? Math.round((answeredWithinThreshold / inboundCalls.length) * 100)
    : 0;

  // ── Occupancy Rate ─────────────────────────────────
  // Agent talk time / total available time (estimated)
  const rangeHours = Math.max(1, (to.getTime() - from.getTime()) / (1000 * 60 * 60));
  const agentHoursAvailable = agentPresence * rangeHours;
  const agentHoursTalking = totalTalkTime / 3600;
  const occupancyRate = agentHoursAvailable > 0
    ? Math.min(100, Math.round((agentHoursTalking / agentHoursAvailable) * 100))
    : 0;

  // ── Hourly distribution (for charts) ───────────────
  const hourlyDistribution: Array<{
    hour: number;
    total: number;
    answered: number;
    abandoned: number;
  }> = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    total: 0,
    answered: 0,
    abandoned: 0,
  }));

  for (const call of allCalls) {
    const hour = new Date(call.startedAt).getHours();
    hourlyDistribution[hour].total++;
    if (call.status === 'COMPLETED') hourlyDistribution[hour].answered++;
    if (call.status === 'MISSED') hourlyDistribution[hour].abandoned++;
  }

  // ── Daily trend (for charts) ───────────────────────
  const dailyMap = new Map<string, { date: string; total: number; answered: number; abandoned: number; aht: number; talkTime: number }>();
  for (const call of allCalls) {
    const dateKey = new Date(call.startedAt).toISOString().split('T')[0];
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { date: dateKey, total: 0, answered: 0, abandoned: 0, aht: 0, talkTime: 0 });
    }
    const day = dailyMap.get(dateKey)!;
    day.total++;
    if (call.status === 'COMPLETED') {
      day.answered++;
      day.talkTime += call.duration || 0;
    }
    if (call.status === 'MISSED') day.abandoned++;
  }

  const dailyTrend = Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      ...d,
      aht: d.answered > 0 ? Math.round(d.talkTime / d.answered) : 0,
    }));

  return apiSuccess({
    dateRange: { from: from.toISOString(), to: to.toISOString() },
    kpis: {
      aht,               // seconds
      asa,               // seconds
      fcr,               // percentage
      abandonRate,        // percentage
      serviceLevel,       // percentage
      occupancyRate,      // percentage
      totalCalls,
      answeredCalls: answeredCalls.length,
      abandonedCalls,
      avgTalkTime: aht,
    },
    hourlyDistribution,
    dailyTrend,
  }, { request });
}, { requiredPermission: 'crm.reports.view' });

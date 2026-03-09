export const dynamic = 'force-dynamic';

/**
 * Call Center KPIs API (J12)
 * GET /api/admin/crm/call-center-kpis - AHT, ASA, FCR, Service Level, Abandon Rate, Occupancy
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ErrorCode } from '@/lib/error-codes';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const querySchema = z.object({
  period: z.enum(['today', 'week', 'month']).default('today'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPeriodStart(period: string): Date {
  const now = new Date();
  if (period === 'week') {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 7);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'month') {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 30);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  // today
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({ period: searchParams.get('period') || 'today' });
    if (!parsed.success) {
      return apiError('Invalid period', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
    }

    const { period } = parsed.data;
    const periodStart = getPeriodStart(period);

    const calls = await prisma.callLog.findMany({
      where: { startedAt: { gte: periodStart } },
      select: {
        id: true, status: true, duration: true, waitTime: true,
        agentId: true, disposition: true, startedAt: true,
        agent: { select: { id: true, extension: true, user: { select: { name: true } } } },
      },
    });

    const totalCalls = calls.length;
    const answered = calls.filter(c => c.status === 'COMPLETED');
    const abandoned = calls.filter(c => c.status === 'MISSED');

    // AHT - Average Handle Time (seconds)
    const aht = answered.length > 0
      ? Math.round(answered.reduce((s, c) => s + (c.duration || 0), 0) / answered.length)
      : 0;

    // ASA - Average Speed of Answer (wait time seconds)
    const asa = answered.length > 0
      ? Math.round(answered.reduce((s, c) => s + (c.waitTime || 0), 0) / answered.length)
      : 0;

    // FCR - First Call Resolution (disposition = 'resolved')
    const resolved = answered.filter(c => c.disposition === 'resolved').length;
    const fcr = answered.length > 0 ? Math.round((resolved / answered.length) * 100) : 0;

    // Service Level (answered within 20s / total offered)
    const answeredWithin20 = answered.filter(c => (c.waitTime || 0) <= 20).length;
    const serviceLevel = totalCalls > 0 ? Math.round((answeredWithin20 / totalCalls) * 100) : 0;

    // Abandon Rate
    const abandonRate = totalCalls > 0 ? Math.round((abandoned.length / totalCalls) * 100) : 0;

    // Occupancy (total talk time / total available time, estimate)
    const totalTalkSeconds = answered.reduce((s, c) => s + (c.duration || 0), 0);
    const uniqueAgents = new Set(calls.filter(c => c.agentId).map(c => c.agentId));
    const hoursElapsed = Math.max(1, (Date.now() - periodStart.getTime()) / 3600000);
    const totalAvailable = uniqueAgents.size * hoursElapsed * 3600;
    const occupancy = totalAvailable > 0 ? Math.min(100, Math.round((totalTalkSeconds / totalAvailable) * 100)) : 0;

    // Agent breakdown
    const agentMap = new Map<string, { name: string; calls: number; answered: number; talkTime: number; fcr: number }>();
    for (const call of calls) {
      const agentKey = call.agentId || 'unassigned';
      const agentName = call.agent?.user?.name || call.agent?.extension || 'Unassigned';
      const existing = agentMap.get(agentKey) || { name: agentName, calls: 0, answered: 0, talkTime: 0, fcr: 0 };
      existing.calls++;
      if (call.status === 'COMPLETED') {
        existing.answered++;
        existing.talkTime += call.duration || 0;
        if (call.disposition === 'resolved') existing.fcr++;
      }
      agentMap.set(agentKey, existing);
    }

    const agents = Array.from(agentMap.entries()).map(([id, a]) => ({
      agentId: id,
      name: a.name,
      totalCalls: a.calls,
      answered: a.answered,
      avgHandleTime: a.answered > 0 ? Math.round(a.talkTime / a.answered) : 0,
      fcrRate: a.answered > 0 ? Math.round((a.fcr / a.answered) * 100) : 0,
    })).sort((a, b) => b.totalCalls - a.totalCalls);

    // Trend data (hourly for today, daily for week/month)
    const trendMap = new Map<string, { label: string; calls: number; answered: number }>();
    for (const call of calls) {
      const d = new Date(call.startedAt);
      const label = period === 'today'
        ? `${d.getUTCHours()}h`
        : `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
      const entry = trendMap.get(label) || { label, calls: 0, answered: 0 };
      entry.calls++;
      if (call.status === 'COMPLETED') entry.answered++;
      trendMap.set(label, entry);
    }

    return apiSuccess({
      period,
      kpis: { aht, asa, fcr, serviceLevel, abandonRate, occupancy, totalCalls, answeredCalls: answered.length },
      agents,
      trends: Array.from(trendMap.values()),
    }, { request });
  } catch (error) {
    logger.error('[crm/call-center-kpis] GET error', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to fetch KPIs', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.reports.view', skipCsrf: true });

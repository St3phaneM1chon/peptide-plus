export const dynamic = 'force-dynamic';

/**
 * CRM Rep Performance Stats API
 * GET /api/admin/crm/reps/[id]/stats?period=quarter|semester|year|all
 * Compute detailed performance statistics for an agent.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPeriodStart(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case 'quarter': {
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      return quarterStart;
    }
    case 'semester': {
      const semesterStart = new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1);
      return semesterStart;
    }
    case 'year': {
      return new Date(now.getFullYear(), 0, 1);
    }
    case 'all':
      return null;
    default:
      return null;
  }
}

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime());
  return ms / (1000 * 60 * 60 * 24);
}

// ---------------------------------------------------------------------------
// GET: Compute detailed performance statistics for the agent
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest, { session, params }: { session: any; params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const period = url.searchParams.get('period') ?? 'all';

    const validPeriods = ['quarter', 'semester', 'year', 'all'];
    if (!validPeriods.includes(period)) {
      return apiError(
        'Invalid period. Must be one of: quarter, semester, year, all',
        ErrorCode.VALIDATION_ERROR,
        { status: 400, request },
      );
    }

    const periodStart = getPeriodStart(period);
    const dateFilter = periodStart ? { gte: periodStart } : undefined;

    // -----------------------------------------------------------------------
    // Parallel data fetching for efficiency
    // -----------------------------------------------------------------------
    const [
      dailyStatsAgg,
      wonDeals,
      lostDealsCount,
      allDeals,
      followUps,
    ] = await Promise.all([
      // AgentDailyStats aggregate
      prisma.agentDailyStats.aggregate({
        where: {
          agentId: id,
          ...(dateFilter ? { date: dateFilter } : {}),
        },
        _sum: {
          callsMade: true,
          conversions: true,
          totalTalkTime: true,
        },
        _avg: {
          avgHandleTime: true,
        },
      }),

      // Won deals
      prisma.crmDeal.findMany({
        where: {
          assignedToId: id,
          stage: { isWon: true },
          ...(dateFilter ? { actualCloseDate: dateFilter } : { actualCloseDate: { not: null } }),
        },
        select: {
          id: true,
          value: true,
          isRecurring: true,
          mrrValue: true,
          createdAt: true,
          actualCloseDate: true,
        },
      }),

      // Lost deals count
      prisma.crmDeal.count({
        where: {
          assignedToId: id,
          stage: { isLost: true },
          ...(dateFilter ? { updatedAt: dateFilter } : {}),
        },
      }),

      // All deals (for pipeline velocity: qualified opps not won/lost)
      prisma.crmDeal.findMany({
        where: {
          assignedToId: id,
          stage: { isWon: false, isLost: false },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        select: { id: true },
      }),

      // Follow-up schedules for retention rate
      prisma.repFollowUpSchedule.findMany({
        where: {
          agentId: id,
          ...(dateFilter ? { scheduledDate: dateFilter } : {}),
        },
        select: {
          status: true,
        },
      }),
    ]);

    // -----------------------------------------------------------------------
    // 1. callToAppointment: conversions / callsMade
    // -----------------------------------------------------------------------
    const totalCallsMade = dailyStatsAgg._sum.callsMade ?? 0;
    const totalConversions = dailyStatsAgg._sum.conversions ?? 0;
    const callToAppointment = totalCallsMade > 0 ? totalConversions / totalCallsMade : 0;

    // -----------------------------------------------------------------------
    // 2. callToSale: deals won / callsMade
    // -----------------------------------------------------------------------
    const dealsWon = wonDeals.length;
    const callToSale = totalCallsMade > 0 ? dealsWon / totalCallsMade : 0;

    // -----------------------------------------------------------------------
    // 3. avgDealSize
    // -----------------------------------------------------------------------
    const totalRevenue = wonDeals.reduce((sum, d) => sum + Number(d.value), 0);
    const avgDealSize = dealsWon > 0 ? totalRevenue / dealsWon : 0;

    // -----------------------------------------------------------------------
    // 5 & 6. dealsWon / dealsLost
    // -----------------------------------------------------------------------
    const dealsLost = lostDealsCount;

    // -----------------------------------------------------------------------
    // 7. winRate
    // -----------------------------------------------------------------------
    const totalDecided = dealsWon + dealsLost;
    const winRate = totalDecided > 0 ? dealsWon / totalDecided : 0;

    // -----------------------------------------------------------------------
    // 9. avgTimeToClose (days)
    // -----------------------------------------------------------------------
    const closeTimes = wonDeals
      .filter((d) => d.actualCloseDate)
      .map((d) => daysBetween(d.createdAt, d.actualCloseDate!));
    const avgTimeToClose = closeTimes.length > 0
      ? closeTimes.reduce((a, b) => a + b, 0) / closeTimes.length
      : 0;

    // -----------------------------------------------------------------------
    // 8. pipelineVelocity: (qualifiedOpps * avgDealSize * winRate) / avgCycleDays
    // -----------------------------------------------------------------------
    const qualifiedOpps = allDeals.length;
    const avgCycleDays = avgTimeToClose > 0 ? avgTimeToClose : 1; // avoid division by zero
    const pipelineVelocity = avgCycleDays > 0
      ? (qualifiedOpps * avgDealSize * winRate) / avgCycleDays
      : 0;

    // -----------------------------------------------------------------------
    // 10. retentionRate: completed follow-ups / total follow-ups
    // -----------------------------------------------------------------------
    const totalFollowUps = followUps.length;
    const completedFollowUps = followUps.filter((f) => f.status === 'COMPLETED').length;
    const retentionRate = totalFollowUps > 0 ? completedFollowUps / totalFollowUps : 0;

    // -----------------------------------------------------------------------
    // 11. recurringRevenue: sum of mrrValue where isRecurring and won
    // -----------------------------------------------------------------------
    const recurringRevenue = wonDeals
      .filter((d) => d.isRecurring && d.mrrValue)
      .reduce((sum, d) => sum + Number(d.mrrValue), 0);

    // -----------------------------------------------------------------------
    // 12-14. Call stats from aggregate
    // -----------------------------------------------------------------------
    const totalCalls = totalCallsMade;
    const totalTalkTime = dailyStatsAgg._sum.totalTalkTime ?? 0;
    const avgHandleTime = dailyStatsAgg._avg.avgHandleTime ?? 0;

    // -----------------------------------------------------------------------
    // Build response
    // -----------------------------------------------------------------------
    const stats = {
      callToAppointment: Math.round(callToAppointment * 10000) / 10000,
      callToSale: Math.round(callToSale * 10000) / 10000,
      avgDealSize: Math.round(avgDealSize * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      dealsWon,
      dealsLost,
      winRate: Math.round(winRate * 10000) / 10000,
      pipelineVelocity: Math.round(pipelineVelocity * 100) / 100,
      avgTimeToClose: Math.round(avgTimeToClose * 100) / 100,
      retentionRate: Math.round(retentionRate * 10000) / 10000,
      recurringRevenue: Math.round(recurringRevenue * 100) / 100,
      totalCalls,
      totalTalkTime,
      avgHandleTime: Math.round(avgHandleTime * 100) / 100,
      period,
      periodStart: periodStart?.toISOString() ?? null,
    };

    return apiSuccess(stats, { request });
  } catch (error) {
    logger.error('[crm/reps/stats] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to compute rep stats', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.reports.view' });

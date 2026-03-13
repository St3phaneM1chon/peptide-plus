export const dynamic = 'force-dynamic';

/**
 * Sales Rep 360° Dashboard - Section-based lazy loading
 * GET /api/admin/crm/reps/[id]/dashboard?section=overview|communications|deals|followups|commissions|quotas
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Period = 'week' | 'month' | 'quarter' | 'year' | 'all';

function computePeriodRange(period: Period): { periodStart: Date | null; periodEnd: Date } {
  const now = new Date();
  const periodEnd = now;

  if (period === 'all') {
    return { periodStart: null, periodEnd };
  }

  const periodStart = new Date(now);

  switch (period) {
    case 'week':
      periodStart.setDate(periodStart.getDate() - 7);
      break;
    case 'month':
      periodStart.setMonth(periodStart.getMonth() - 1);
      break;
    case 'quarter':
      periodStart.setMonth(periodStart.getMonth() - 3);
      break;
    case 'year':
      periodStart.setFullYear(periodStart.getFullYear() - 1);
      break;
  }

  return { periodStart, periodEnd };
}

function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// ---------------------------------------------------------------------------
// Section handlers
// ---------------------------------------------------------------------------

async function getOverview(agentId: string, periodStart: Date | null, periodEnd: Date) {
  const dateFilter = periodStart
    ? { gte: periodStart, lte: periodEnd }
    : { lte: periodEnd };

  const [
    callsAgg,
    revenueAgg,
    dealsWon,
    dealsLost,
    activeLeads,
    pipelineValueResult,
    followUpsDue,
    commissionEarned,
  ] = await Promise.all([
    // Total calls
    prisma.agentDailyStats.aggregate({
      where: { agentId, date: dateFilter },
      _sum: { callsMade: true },
    }),
    // Total revenue
    prisma.agentDailyStats.aggregate({
      where: { agentId, date: dateFilter },
      _sum: { revenue: true },
    }),
    // Deals won
    prisma.crmDeal.count({
      where: {
        assignedToId: agentId,
        stage: { isWon: true },
        actualCloseDate: dateFilter,
      },
    }),
    // Deals lost
    prisma.crmDeal.count({
      where: {
        assignedToId: agentId,
        stage: { isLost: true },
        actualCloseDate: dateFilter,
      },
    }),
    // Active leads
    prisma.crmLead.count({
      where: {
        assignedToId: agentId,
        status: { notIn: ['CONVERTED', 'LOST'] },
      },
    }),
    // Pipeline value (deals not won and not lost)
    prisma.crmDeal.aggregate({
      where: {
        assignedToId: agentId,
        stage: { isWon: false, isLost: false },
      },
      _sum: { value: true },
    }),
    // Follow-ups due
    prisma.repFollowUpSchedule.count({
      where: {
        agentId,
        status: { in: ['PENDING', 'OVERDUE'] },
      },
    }),
    // Commission earned (PAID in period)
    prisma.commissionPayout.aggregate({
      where: {
        agentId,
        status: 'PAID',
        ...(periodStart ? { periodStart: { gte: periodStart }, periodEnd: { lte: periodEnd } } : {}),
      },
      _sum: { totalPayout: true },
    }),
  ]);

  return {
    totalCalls: callsAgg._sum.callsMade || 0,
    totalRevenue: revenueAgg._sum.revenue || 0,
    dealsWon,
    dealsLost,
    activeLeads,
    pipelineValue: pipelineValueResult._sum.value || 0,
    followUpsDue,
    commissionEarned: commissionEarned._sum.totalPayout || 0,
  };
}

async function getCommunications(
  agentId: string,
  periodStart: Date | null,
  periodEnd: Date,
  searchParams: URLSearchParams,
) {
  const { page, limit, skip } = parsePagination(searchParams);
  const type = searchParams.get('type'); // CALL, EMAIL, SMS, MEETING, NOTE

  const where: any = {
    performedById: agentId,
  };

  if (periodStart) {
    where.createdAt = { gte: periodStart, lte: periodEnd };
  }

  if (type) {
    where.type = type;
  }

  const [activities, total] = await Promise.all([
    prisma.crmActivity.findMany({
      where,
      include: {
        lead: { select: { id: true, contactName: true } },
        deal: { select: { id: true, title: true, value: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.crmActivity.count({ where }),
  ]);

  return { activities, total, page, limit };
}

async function getDeals(
  agentId: string,
  searchParams: URLSearchParams,
) {
  const { page, limit, skip } = parsePagination(searchParams);

  const where = { assignedToId: agentId };

  const [deals, total] = await Promise.all([
    prisma.crmDeal.findMany({
      where,
      include: {
        stage: true,
        dealTeamMembers: true,
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.crmDeal.count({ where }),
  ]);

  return { deals, total, page, limit };
}

async function getFollowUps(
  agentId: string,
  searchParams: URLSearchParams,
) {
  const { page, limit, skip } = parsePagination(searchParams);
  const status = searchParams.get('status'); // PENDING, COMPLETED, OVERDUE, SKIPPED, RESCHEDULED

  const where: any = { agentId };

  if (status) {
    where.status = status;
  }

  const [followUps, total] = await Promise.all([
    prisma.repFollowUpSchedule.findMany({
      where,
      include: {
        lead: { select: { id: true, contactName: true } },
        deal: { select: { id: true, title: true, value: true } },
        customer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { scheduledDate: 'asc' },
      skip,
      take: limit,
    }),
    prisma.repFollowUpSchedule.count({ where }),
  ]);

  return { followUps, total, page, limit };
}

async function getCommissions(
  agentId: string,
  searchParams: URLSearchParams,
) {
  const { page, limit, skip } = parsePagination(searchParams);

  const where = { agentId };

  const [payouts, total] = await Promise.all([
    prisma.commissionPayout.findMany({
      where,
      include: {
        tier: true,
      },
      orderBy: { periodStart: 'desc' },
      skip,
      take: limit,
    }),
    prisma.commissionPayout.count({ where }),
  ]);

  return { payouts, total, page, limit };
}

async function getQuotas(
  agentId: string,
  periodStart: Date | null,
  periodEnd: Date,
  searchParams: URLSearchParams,
) {
  const { page, limit, skip } = parsePagination(searchParams);

  const where: any = { agentId };

  if (periodStart) {
    where.periodStart = { gte: periodStart };
    where.periodEnd = { lte: periodEnd };
  }

  const dateFilter = periodStart
    ? { gte: periodStart, lte: periodEnd }
    : { lte: periodEnd };

  const [quotas, totalCount, statsAgg] = await Promise.all([
    prisma.crmQuota.findMany({
      where,
      orderBy: { periodStart: 'desc' },
      skip,
      take: limit,
    }),
    prisma.crmQuota.count({ where }),
    prisma.agentDailyStats.aggregate({
      where: { agentId, date: dateFilter },
      _sum: {
        callsMade: true,
        revenue: true,
        conversions: true,
      },
    }),
  ]);

  return {
    quotas,
    total: totalCount,
    page,
    limit,
    periodStats: {
      totalCalls: statsAgg._sum.callsMade || 0,
      totalRevenue: statsAgg._sum.revenue || 0,
      totalConversions: statsAgg._sum.conversions || 0,
    },
  };
}

// ---------------------------------------------------------------------------
// GET: Section-based dashboard data
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest, { session, params }: { session: any; params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section') || 'overview';
  const period = (searchParams.get('period') || 'month') as Period;

  // Validate section
  const validSections = ['overview', 'communications', 'deals', 'followups', 'commissions', 'quotas'];
  if (!validSections.includes(section)) {
    return apiError(
      `Invalid section: ${section}. Valid sections: ${validSections.join(', ')}`,
      ErrorCode.VALIDATION_ERROR,
      { status: 400, request },
    );
  }

  // Validate period
  const validPeriods = ['week', 'month', 'quarter', 'year', 'all'];
  if (!validPeriods.includes(period)) {
    return apiError(
      `Invalid period: ${period}. Valid periods: ${validPeriods.join(', ')}`,
      ErrorCode.VALIDATION_ERROR,
      { status: 400, request },
    );
  }

  // Verify the rep exists and is EMPLOYEE or OWNER
  const rep = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, name: true },
  });

  if (!rep) {
    return apiError('Rep not found', ErrorCode.NOT_FOUND, { status: 404, request });
  }

  if (!['EMPLOYEE', 'OWNER'].includes(rep.role)) {
    return apiError('User is not a sales rep', ErrorCode.VALIDATION_ERROR, { status: 400, request });
  }

  const { periodStart, periodEnd } = computePeriodRange(period);

  try {
    let data: any;

    switch (section) {
      case 'overview':
        data = await getOverview(id, periodStart, periodEnd);
        break;
      case 'communications':
        data = await getCommunications(id, periodStart, periodEnd, searchParams);
        break;
      case 'deals':
        data = await getDeals(id, searchParams);
        break;
      case 'followups':
        data = await getFollowUps(id, searchParams);
        break;
      case 'commissions':
        data = await getCommissions(id, searchParams);
        break;
      case 'quotas':
        data = await getQuotas(id, periodStart, periodEnd, searchParams);
        break;
    }

    return apiSuccess({ section, period, agentId: id, ...data }, { request });
  } catch (error) {
    logger.error('Failed to load dashboard section', {
      event: 'rep_dashboard_error',
      section,
      agentId: id,
      error: error instanceof Error ? error.message : String(error),
      userId: session.user?.id,
    });
    return apiError('Failed to load dashboard section', ErrorCode.INTERNAL_ERROR, {
      status: 500,
      request,
    });
  }
}, { requiredPermission: 'crm.reports.view' });

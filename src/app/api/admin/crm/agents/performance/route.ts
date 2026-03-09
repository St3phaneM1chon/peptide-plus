export const dynamic = 'force-dynamic';

/**
 * Agent Performance API
 * GET: Aggregated performance metrics for all agents
 */

import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess } from '@/lib/api-response';
import { prisma } from '@/lib/db';

export const GET = withAdminGuard(async (request) => {
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || 'today';

  // Calculate date range
  const now = new Date();
  let startDate: Date;
  switch (period) {
    case 'week': {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      startDate.setHours(0, 0, 0, 0);
      break;
    }
    case 'month': {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    }
    default: {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    }
  }

  // Get all agents (EMPLOYEE or OWNER)
  const agents = await prisma.user.findMany({
    where: { role: { in: ['EMPLOYEE', 'OWNER'] } },
    select: { id: true, name: true, email: true },
  });

  // Get aggregated stats per agent
  const agentStats = await prisma.agentDailyStats.groupBy({
    by: ['agentId'],
    where: { date: { gte: startDate } },
    _sum: {
      callsMade: true,
      callsAnswered: true,
      totalTalkTime: true,
      totalWrapTime: true,
      conversions: true,
      revenue: true,
      breakTime: true,
    },
    _avg: {
      avgHandleTime: true,
      avgTalkTime: true,
    },
  });

  // Build response
  const statsMap = new Map(agentStats.map(s => [s.agentId, s]));

  const result = agents.map((agent, index) => {
    const s = statsMap.get(agent.id);
    const callsMade = s?._sum?.callsMade || 0;
    const callsAnswered = s?._sum?.callsAnswered || 0;
    const conversions = s?._sum?.conversions || 0;
    const revenue = Number(s?._sum?.revenue || 0);
    const totalTalkTime = s?._sum?.totalTalkTime || 0;
    const avgHandleTime = s?._avg?.avgHandleTime || 0;
    const breakTime = s?._sum?.breakTime || 0;

    return {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      stats: {
        callsMade,
        callsAnswered,
        totalTalkTime,
        avgHandleTime,
        conversions,
        revenue,
        breakTime,
      },
      contactRate: callsMade > 0 ? Math.round((callsAnswered / callsMade) * 100) : 0,
      conversionRate: callsAnswered > 0 ? Math.round((conversions / callsAnswered) * 100) : 0,
      rank: index + 1,
    };
  }).sort((a, b) => b.stats.conversions - a.stats.conversions)
    .map((a, i) => ({ ...a, rank: i + 1 }));

  return apiSuccess(result, { request });
}, { requiredPermission: 'crm.reports.view' });

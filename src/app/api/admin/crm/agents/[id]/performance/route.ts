export const dynamic = 'force-dynamic';

/**
 * CRM Agent Performance API
 * GET /api/admin/crm/agents/[id]/performance - Agent performance stats (last 30 days)
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';

// ---------------------------------------------------------------------------
// GET: Agent performance
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const { id } = params;

  // Verify agent (user) exists
  const agent = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true },
  });

  if (!agent) {
    return apiError('Agent not found', ErrorCode.RESOURCE_NOT_FOUND, { request });
  }

  // Last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

  const dailyStats = await prisma.agentDailyStats.findMany({
    where: {
      agentId: id,
      date: { gte: thirtyDaysAgo },
    },
    orderBy: { date: 'asc' },
  });

  // Compute summary
  const totalCalls = dailyStats.reduce((sum, s) => sum + s.callsMade + s.callsReceived, 0);
  const totalTalkTime = dailyStats.reduce((sum, s) => sum + s.totalTalkTime, 0);
  const totalConversions = dailyStats.reduce((sum, s) => sum + s.conversions, 0);
  const totalRevenue = dailyStats.reduce((sum, s) => sum + Number(s.revenue), 0);
  const daysWithData = dailyStats.length;
  const avgCallsPerDay = daysWithData > 0
    ? Math.round((totalCalls / daysWithData) * 100) / 100
    : 0;
  const avgHandleTime = daysWithData > 0
    ? Math.round(dailyStats.reduce((sum, s) => sum + s.avgHandleTime, 0) / daysWithData * 100) / 100
    : 0;

  return apiSuccess({
    agent,
    summary: {
      totalCalls,
      totalTalkTime,
      avgHandleTime,
      totalConversions,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgCallsPerDay,
    },
    dailyStats,
  }, { request });
}, { requiredPermission: 'crm.reports.view' });

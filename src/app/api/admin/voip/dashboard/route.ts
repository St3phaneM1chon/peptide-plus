export const dynamic = 'force-dynamic';

/**
 * VoIP Dashboard API
 * GET - Returns aggregated VoIP metrics for the dashboard
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

export const GET = withAdminGuard(async (request) => {
  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const fromDate = dateFrom ? new Date(dateFrom) : startOfMonth;
  const toDate = dateTo ? new Date(dateTo) : now;

  const dateFilter = { startedAt: { gte: fromDate, lte: toDate } };
  const todayFilter = { startedAt: { gte: startOfDay, lte: now } };

  const [
    // Today's stats
    callsToday,
    completedToday,
    missedToday,
    avgDurationToday,
    // Period stats
    callsPeriod,
    completedPeriod,
    missedPeriod,
    avgDurationPeriod,
    // Surveys
    avgSatisfaction,
    // Active agents
    activeAgents,
    // Unread voicemails
    unreadVoicemails,
    // Calls by direction (period)
    inboundPeriod,
    outboundPeriod,
    // Recent calls
    recentCalls,
  ] = await prisma.$transaction([
    // Today
    prisma.callLog.count({ where: todayFilter }),
    prisma.callLog.count({ where: { ...todayFilter, status: 'COMPLETED' } }),
    prisma.callLog.count({ where: { ...todayFilter, status: 'MISSED' } }),
    prisma.callLog.aggregate({ where: { ...todayFilter, duration: { not: null } }, _avg: { duration: true } }),
    // Period
    prisma.callLog.count({ where: dateFilter }),
    prisma.callLog.count({ where: { ...dateFilter, status: 'COMPLETED' } }),
    prisma.callLog.count({ where: { ...dateFilter, status: 'MISSED' } }),
    prisma.callLog.aggregate({ where: { ...dateFilter, duration: { not: null } }, _avg: { duration: true } }),
    // Satisfaction
    prisma.callSurvey.aggregate({ where: { callLog: dateFilter }, _avg: { overallScore: true } }),
    // Agents online
    prisma.sipExtension.count({ where: { status: { in: ['ONLINE', 'BUSY'] } } }),
    // Voicemails
    prisma.voicemail.count({ where: { isRead: false } }),
    // Direction
    prisma.callLog.count({ where: { ...dateFilter, direction: 'INBOUND' } }),
    prisma.callLog.count({ where: { ...dateFilter, direction: 'OUTBOUND' } }),
    // Recent
    prisma.callLog.findMany({
      where: {},
      include: {
        agent: { select: { extension: true, user: { select: { name: true } } } },
        client: { select: { name: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 10,
    }),
  ]);

  const answerRateToday = callsToday > 0
    ? Math.round((completedToday / callsToday) * 100)
    : 0;
  const answerRatePeriod = callsPeriod > 0
    ? Math.round((completedPeriod / callsPeriod) * 100)
    : 0;

  return NextResponse.json({
    today: {
      calls: callsToday,
      completed: completedToday,
      missed: missedToday,
      avgDuration: Math.round(avgDurationToday._avg.duration || 0),
      answerRate: answerRateToday,
    },
    period: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      calls: callsPeriod,
      completed: completedPeriod,
      missed: missedPeriod,
      avgDuration: Math.round(avgDurationPeriod._avg.duration || 0),
      answerRate: answerRatePeriod,
      inbound: inboundPeriod,
      outbound: outboundPeriod,
    },
    satisfaction: {
      avgScore: avgSatisfaction._avg.overallScore
        ? Math.round(avgSatisfaction._avg.overallScore * 10) / 10
        : null,
    },
    activeAgents,
    unreadVoicemails,
    recentCalls,
  });
}, { skipCsrf: true });

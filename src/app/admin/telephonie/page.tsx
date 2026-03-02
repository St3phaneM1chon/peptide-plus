export const dynamic = 'force-dynamic';

/**
 * VoIP Dashboard - Main telephony admin page
 * Shows KPI cards, recent calls, and agent status.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import VoipDashboardClient from './VoipDashboardClient';

async function getVoipData() {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [
    callsToday,
    completedToday,
    missedToday,
    avgDurationToday,
    callsMonth,
    completedMonth,
    avgSatisfaction,
    activeAgents,
    unreadVoicemails,
    recentCalls,
    connections,
  ] = await prisma.$transaction([
    prisma.callLog.count({ where: { startedAt: { gte: startOfDay } } }),
    prisma.callLog.count({ where: { startedAt: { gte: startOfDay }, status: 'COMPLETED' } }),
    prisma.callLog.count({ where: { startedAt: { gte: startOfDay }, status: 'MISSED' } }),
    prisma.callLog.aggregate({ where: { startedAt: { gte: startOfDay }, duration: { not: null } }, _avg: { duration: true } }),
    prisma.callLog.count({ where: { startedAt: { gte: startOfMonth } } }),
    prisma.callLog.count({ where: { startedAt: { gte: startOfMonth }, status: 'COMPLETED' } }),
    prisma.callSurvey.aggregate({ where: { callLog: { startedAt: { gte: startOfMonth } } }, _avg: { overallScore: true } }),
    prisma.sipExtension.count({ where: { status: { in: ['ONLINE', 'BUSY'] } } }),
    prisma.voicemail.count({ where: { isRead: false } }),
    prisma.callLog.findMany({
      include: {
        agent: { select: { extension: true, user: { select: { name: true } } } },
        client: { select: { name: true, email: true } },
        survey: { select: { overallScore: true } },
        recording: { select: { id: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 15,
    }),
    prisma.voipConnection.findMany({
      select: { id: true, provider: true, isEnabled: true, lastSyncAt: true, syncStatus: true },
    }),
  ]);

  return {
    today: {
      calls: callsToday,
      completed: completedToday,
      missed: missedToday,
      avgDuration: Math.round(avgDurationToday._avg.duration || 0),
      answerRate: callsToday > 0 ? Math.round((completedToday / callsToday) * 100) : 0,
    },
    month: {
      calls: callsMonth,
      completed: completedMonth,
      answerRate: callsMonth > 0 ? Math.round((completedMonth / callsMonth) * 100) : 0,
    },
    satisfaction: {
      avgScore: avgSatisfaction._avg.overallScore
        ? Math.round(avgSatisfaction._avg.overallScore * 10) / 10
        : null,
    },
    activeAgents,
    unreadVoicemails,
    recentCalls: JSON.parse(JSON.stringify(recentCalls)),
    connections,
  };
}

export default async function VoipDashboardPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  const data = await getVoipData();

  return <VoipDashboardClient data={data} />;
}

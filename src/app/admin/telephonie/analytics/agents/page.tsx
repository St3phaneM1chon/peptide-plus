export const dynamic = 'force-dynamic';

/**
 * Agent Performance Analytics Page.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import AgentsClient from './AgentsClient';

export default async function AgentsAnalyticsPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  // Fetch all extensions with call data
  const extensions = await prisma.sipExtension.findMany({
    include: {
      user: { select: { name: true, email: true } },
      callsAsAgent: {
        select: {
          id: true,
          status: true,
          duration: true,
          waitTime: true,
          direction: true,
          startedAt: true,
          answeredAt: true,
          endedAt: true,
        },
        orderBy: { startedAt: 'desc' },
        take: 500, // Last 500 calls per agent for performance calc
      },
    },
    orderBy: { extension: 'asc' },
    take: 200,
  });

  // Compute per-agent metrics
  const agentMetrics = extensions.map((ext) => {
    const calls = ext.callsAsAgent;
    const totalCalls = calls.length;
    const answered = calls.filter((c) => c.status === 'COMPLETED').length;
    const missed = calls.filter((c) => c.status === 'MISSED').length;

    // Average Handle Time (total duration for completed calls)
    const completedCalls = calls.filter((c) => c.status === 'COMPLETED' && c.duration);
    const avgHandleTime = completedCalls.length > 0
      ? Math.round(completedCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / completedCalls.length)
      : 0;

    // Average Talk Time (answered to end)
    const talkTimes = completedCalls
      .filter((c) => c.answeredAt && c.endedAt)
      .map((c) => (new Date(c.endedAt!).getTime() - new Date(c.answeredAt!).getTime()) / 1000);
    const avgTalkTime = talkTimes.length > 0
      ? Math.round(talkTimes.reduce((a, b) => a + b, 0) / talkTimes.length)
      : 0;

    // Average Wrap Time (estimated as handle - talk)
    const avgWrapTime = Math.max(0, avgHandleTime - avgTalkTime);

    // Calls per hour (rough estimate based on total time span)
    let callsPerHour = 0;
    if (calls.length >= 2) {
      const newest = new Date(calls[0].startedAt).getTime();
      const oldest = new Date(calls[calls.length - 1].startedAt).getTime();
      const hours = (newest - oldest) / (1000 * 60 * 60);
      callsPerHour = hours > 0 ? Math.round((totalCalls / hours) * 10) / 10 : 0;
    }

    // Utilization (% of time on calls vs available, estimated)
    const utilization = totalCalls > 0 ? Math.min(100, Math.round((answered / totalCalls) * 100)) : 0;

    return {
      id: ext.id,
      name: ext.user?.name || ext.user?.email || 'Unknown',
      extension: ext.extension,
      totalCalls,
      answered,
      missed,
      avgHandleTime,
      avgTalkTime,
      avgWrapTime,
      fcr: totalCalls > 0 ? Math.round((answered / totalCalls) * 100) : 0,
      csat: 0, // Would come from CallSurvey, placeholder
      qualityScore: 0, // Would come from QA system, placeholder
      callsPerHour,
      utilization,
    };
  });

  return <AgentsClient agents={JSON.parse(JSON.stringify(agentMetrics))} />;
}

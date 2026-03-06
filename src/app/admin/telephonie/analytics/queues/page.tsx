export const dynamic = 'force-dynamic';

/**
 * Queue Analytics Page.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import QueuesClient from './QueuesClient';

export default async function QueuesAnalyticsPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  // Fetch all active queues
  const queues = await prisma.callQueue.findMany({
    where: { isActive: true },
    include: {
      members: true,
    },
    orderBy: { name: 'asc' },
    take: 200,
  });

  // Fetch call logs grouped by queue
  const callsByQueue = await prisma.callLog.groupBy({
    by: ['queue'],
    where: {
      queue: { not: null },
    },
    _count: { id: true },
    _avg: { waitTime: true, duration: true },
  });

  // Fetch completed/missed counts per queue
  const completedByQueue = await prisma.callLog.groupBy({
    by: ['queue'],
    where: {
      queue: { not: null },
      status: 'COMPLETED',
    },
    _count: { id: true },
  });

  const missedByQueue = await prisma.callLog.groupBy({
    by: ['queue'],
    where: {
      queue: { not: null },
      status: { in: ['MISSED', 'VOICEMAIL'] },
    },
    _count: { id: true },
  });

  // Build queue metrics
  const queueMetrics = queues.map((q) => {
    const stats = callsByQueue.find((c) => c.queue === q.name);
    const completed = completedByQueue.find((c) => c.queue === q.name);
    const missed = missedByQueue.find((c) => c.queue === q.name);

    const totalOffered = stats?._count.id || 0;
    const totalAnswered = completed?._count.id || 0;
    const totalAbandoned = missed?._count.id || 0;
    const avgWait = Math.round(stats?._avg.waitTime || 0);

    // SLA: % of calls answered within threshold (estimated)
    const sla = totalOffered > 0 ? Math.round((totalAnswered / totalOffered) * 100) : 100;
    const abandonRate = totalOffered > 0 ? Math.round((totalAbandoned / totalOffered) * 100) : 0;

    return {
      id: q.id,
      name: q.name,
      strategy: q.strategy,
      memberCount: q.members.length,
      slaPercent: sla,
      asa: avgWait, // Average Speed of Answer
      abandonRate,
      avgWaitTime: avgWait,
      peakHour: '-', // Would need hourly grouping
      totalOffered,
      totalAnswered,
      totalAbandoned,
    };
  });

  return <QueuesClient queues={JSON.parse(JSON.stringify(queueMetrics))} />;
}

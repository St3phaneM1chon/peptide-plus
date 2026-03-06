export const dynamic = 'force-dynamic';

/**
 * Wallboard Page - Real-time call center overview.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import WallboardClient from './WallboardClient';

export default async function WallboardPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch initial data
  const [callsToday, activeCalls, agents, queues] = await Promise.all([
    prisma.callLog.count({
      where: { startedAt: { gte: today } },
    }),
    prisma.callLog.count({
      where: { status: 'IN_PROGRESS' },
    }),
    prisma.sipExtension.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { extension: 'asc' },
      take: 200,
    }),
    prisma.callQueue.findMany({
      where: { isActive: true },
      include: {
        members: {
          include: { user: { select: { name: true } } },
        },
      },
      take: 200,
    }),
  ]);

  // Compute answered / missed today
  const [answeredToday, missedToday] = await Promise.all([
    prisma.callLog.count({
      where: { startedAt: { gte: today }, status: 'COMPLETED' },
    }),
    prisma.callLog.count({
      where: { startedAt: { gte: today }, status: 'MISSED' },
    }),
  ]);

  // Average wait time for today's calls
  const avgWaitResult = await prisma.callLog.aggregate({
    where: { startedAt: { gte: today }, waitTime: { not: null } },
    _avg: { waitTime: true },
  });

  const initialData = {
    callsToday,
    activeCalls,
    answeredToday,
    missedToday,
    agentsOnline: agents.filter((a) => a.status === 'ONLINE' || a.status === 'BUSY').length,
    avgWaitTime: Math.round(avgWaitResult._avg.waitTime || 0),
    agents: agents.map((a) => ({
      id: a.id,
      extension: a.extension,
      name: a.user?.name || a.user?.email || 'Unknown',
      status: a.status,
      isRegistered: a.isRegistered,
    })),
    queues: queues.map((q) => ({
      id: q.id,
      name: q.name,
      memberCount: q.members.length,
      strategy: q.strategy,
    })),
  };

  return <WallboardClient initialData={JSON.parse(JSON.stringify(initialData))} />;
}

export const dynamic = 'force-dynamic';

/**
 * Coaching Dashboard Page - View coaching sessions and agent scores.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import CoachingClient from './CoachingClient';

export default async function CoachingPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  const sessions = await prisma.coachingSession.findMany({
    include: {
      coach: { select: { id: true, name: true, email: true } },
      student: { select: { id: true, name: true, email: true } },
      scores: true,
    },
    orderBy: { scheduledAt: 'desc' },
    take: 50,
  });

  // Fetch available users for quick actions
  const users = await prisma.user.findMany({
    where: { role: { in: ['EMPLOYEE', 'OWNER'] } },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
    take: 200,
  });

  return (
    <CoachingClient
      initialSessions={JSON.parse(JSON.stringify(sessions))}
      availableUsers={JSON.parse(JSON.stringify(users))}
      currentUserId={session.user.id}
    />
  );
}

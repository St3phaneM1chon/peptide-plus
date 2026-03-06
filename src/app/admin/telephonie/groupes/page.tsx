export const dynamic = 'force-dynamic';

/**
 * Ring Groups Page - Manage ring groups and member assignments.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import GroupesClient from './GroupesClient';

export default async function GroupesPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  const queues = await prisma.callQueue.findMany({
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
    take: 200,
  });

  // Fetch users eligible to be members
  const users = await prisma.user.findMany({
    where: { role: { in: ['EMPLOYEE', 'OWNER'] } },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
    take: 200,
  });

  return (
    <GroupesClient
      initialGroups={JSON.parse(JSON.stringify(queues))}
      availableUsers={JSON.parse(JSON.stringify(users))}
    />
  );
}

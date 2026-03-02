export const dynamic = 'force-dynamic';

/**
 * Call Recordings Page
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import RecordingsClient from './RecordingsClient';

export default async function RecordingsPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  const recordings = await prisma.callRecording.findMany({
    where: { isUploaded: true },
    include: {
      callLog: {
        select: {
          callerNumber: true,
          callerName: true,
          calledNumber: true,
          direction: true,
          startedAt: true,
          agent: { select: { extension: true, user: { select: { name: true } } } },
          client: { select: { name: true } },
        },
      },
      transcription: { select: { summary: true, sentiment: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return <RecordingsClient recordings={JSON.parse(JSON.stringify(recordings))} />;
}

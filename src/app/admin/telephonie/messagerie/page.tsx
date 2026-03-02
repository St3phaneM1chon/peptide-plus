export const dynamic = 'force-dynamic';

/**
 * Voicemail Page
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import VoicemailClient from './VoicemailClient';

export default async function VoicemailPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  const voicemails = await prisma.voicemail.findMany({
    where: { isArchived: false },
    include: {
      extension: {
        select: {
          extension: true,
          user: { select: { name: true } },
        },
      },
      client: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return <VoicemailClient voicemails={JSON.parse(JSON.stringify(voicemails))} />;
}

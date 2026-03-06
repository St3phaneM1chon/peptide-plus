export const dynamic = 'force-dynamic';

/**
 * Campaigns Page - Manage outbound dialing campaigns.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import CampagnesClient from './CampagnesClient';

export default async function CampagnesPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  const campaigns = await prisma.dialerCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return <CampagnesClient initialCampaigns={JSON.parse(JSON.stringify(campaigns))} />;
}

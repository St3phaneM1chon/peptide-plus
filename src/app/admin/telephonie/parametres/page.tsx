export const dynamic = 'force-dynamic';

/**
 * Telephony Settings Page - Global telephony configuration.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import ParametresClient from './ParametresClient';

export default async function ParametresPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  // Fetch all VoIP settings from SiteSetting
  const settings = await prisma.siteSetting.findMany({
    where: { module: 'voip' },
    take: 200,
  });

  // Convert to key-value map
  const settingsMap: Record<string, string> = {};
  for (const s of settings) {
    settingsMap[s.key] = s.value;
  }

  return <ParametresClient settings={settingsMap} />;
}

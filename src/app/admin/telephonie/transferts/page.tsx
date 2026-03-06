export const dynamic = 'force-dynamic';

/**
 * Call Forwarding Page - Manage call forwarding rules per extension.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import TransfertsClient from './TransfertsClient';

export default async function TransfertsPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  // Fetch forwarding rules from SiteSetting
  const setting = await prisma.siteSetting.findUnique({
    where: { key: 'voip:forwarding_rules' },
  });

  let rules: Array<{
    id: string;
    extension: string;
    condition: string;
    destination: string;
    ringDuration: number;
    enabled: boolean;
  }> = [];

  if (setting?.value) {
    try {
      rules = JSON.parse(setting.value);
    } catch {
      rules = [];
    }
  }

  // Fetch extensions for the dropdown
  const extensions = await prisma.sipExtension.findMany({
    select: { id: true, extension: true, user: { select: { name: true } } },
    orderBy: { extension: 'asc' },
    take: 200,
  });

  return (
    <TransfertsClient
      initialRules={rules}
      extensions={JSON.parse(JSON.stringify(extensions))}
    />
  );
}

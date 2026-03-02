export const dynamic = 'force-dynamic';

/**
 * SIP Extensions Page - Manage agent SIP extensions.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import ExtensionsClient from './ExtensionsClient';

export default async function ExtensionsPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  const extensions = await prisma.sipExtension.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { extension: 'asc' },
  });

  return <ExtensionsClient extensions={JSON.parse(JSON.stringify(extensions))} />;
}

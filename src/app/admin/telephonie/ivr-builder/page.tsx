export const dynamic = 'force-dynamic';

/**
 * IVR Visual Builder Page - Drag-drop IVR flow editor.
 * Fetches IvrMenu records from Prisma with their options.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import IvrBuilderClient from './IvrBuilderClient';

export default async function IvrBuilderPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  // Fetch all IVR menus with their options
  const menus = await prisma.ivrMenu.findMany({
    where: { isActive: true },
    include: {
      options: { orderBy: { sortOrder: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return <IvrBuilderClient initialMenus={JSON.parse(JSON.stringify(menus))} />;
}

export const dynamic = 'force-dynamic';

/**
 * Call Log Page - Full list of calls with search and filters.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import CallLogClient from './CallLogClient';

export default async function CallLogPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  return <CallLogClient />;
}

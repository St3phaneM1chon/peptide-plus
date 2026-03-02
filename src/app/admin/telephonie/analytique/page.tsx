export const dynamic = 'force-dynamic';

/**
 * VoIP Analytics Page
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import AnalyticsClient from './AnalyticsClient';

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  return <AnalyticsClient />;
}

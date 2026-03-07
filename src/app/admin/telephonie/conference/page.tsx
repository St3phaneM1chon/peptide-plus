export const dynamic = 'force-dynamic';

/**
 * Video Conference Lobby Page
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import ConferenceClient from './ConferenceClient';

export default async function ConferencePage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  return <ConferenceClient />;
}

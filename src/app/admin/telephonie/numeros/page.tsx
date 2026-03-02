export const dynamic = 'force-dynamic';

/**
 * Phone Numbers Page - Manage DIDs and phone number routing.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import PhoneNumbersClient from './PhoneNumbersClient';

export default async function PhoneNumbersPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  return <PhoneNumbersClient />;
}

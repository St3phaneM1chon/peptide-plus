export const dynamic = 'force-dynamic';

/**
 * Video Conference Room Page
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import ConferenceRoomClient from '../ConferenceRoomClient';

interface Props {
  params: Promise<{ roomName: string }>;
}

export default async function ConferenceRoomPage({ params }: Props) {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  const { roomName } = await params;

  return <ConferenceRoomClient roomName={roomName} />;
}

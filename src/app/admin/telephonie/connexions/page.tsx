export const dynamic = 'force-dynamic';

/**
 * VoIP Connections Page - Configure SIP trunks and PBX connections.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { listVoipConnections } from '@/lib/voip/connection';
import ConnectionsClient from './ConnectionsClient';

export default async function ConnectionsPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
    redirect('/auth/signin');
  }

  const connections = await listVoipConnections();

  return <ConnectionsClient initialConnections={JSON.parse(JSON.stringify(connections))} />;
}

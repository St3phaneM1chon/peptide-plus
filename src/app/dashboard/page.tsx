export const dynamic = 'force-dynamic';

/**
 * DASHBOARD - Redirection selon le rôle
 * - CUSTOMER → Page d'accueil (pour acheter)
 * - CLIENT → Dashboard client
 * - EMPLOYEE → Dashboard employé
 * - OWNER → Dashboard propriétaire
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const role = session.user.role;

  // Redirection selon le rôle
  switch (role) {
    case 'OWNER':
      redirect('/owner/dashboard');
    
    case 'EMPLOYEE':
      redirect('/dashboard/employee');
    
    case 'CLIENT':
      redirect('/dashboard/client');
    
    case 'CUSTOMER':
      // Les customers ont leur espace personnel (profil, achats)
      redirect('/dashboard/customer');
    
    case 'PUBLIC':
    default:
      // Les visiteurs publics vont à la page d'accueil
      redirect('/');
  }
}

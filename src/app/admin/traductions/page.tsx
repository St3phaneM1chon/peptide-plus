export const dynamic = 'force-dynamic';
/**
 * ADMIN - Gestion des traductions automatiques
 * Vue d'ensemble: couverture par modèle/langue, déclenchement, file d'attente
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import TranslationsDashboard from './TranslationsDashboard';

export default async function TranslationsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/login');
  }

  if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
    redirect('/admin/dashboard');
  }

  return <TranslationsDashboard />;
}

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';

/**
 * Post-login page - Server Component
 * Checks session server-side and redirects based on role.
 * This avoids the race condition where client-side useSession()
 * returns "unauthenticated" before the session cookie is detected.
 */
export default async function PostLoginPage() {
  const session = await auth();

  if (!session?.user) {
    // Not authenticated - redirect to signin
    redirect('/auth/signin');
  }

  const role = (session.user as Record<string, unknown>)?.role;

  if (role === 'OWNER' || role === 'EMPLOYEE' || role === 'CLIENT') {
    redirect('/admin');
  } else {
    // CUSTOMER -> page d'accueil
    redirect('/');
  }
}

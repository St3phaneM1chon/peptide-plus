import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';

/**
 * Post-login page - Server Component
 * Checks session server-side and redirects based on role.
 * This avoids the race condition where client-side useSession()
 * returns "unauthenticated" before the session cookie is detected.
 *
 * RGPD: If the user hasn't accepted Terms of Service yet (OAuth signup),
 * redirect to the accept-terms page before allowing access.
 */
export default async function PostLoginPage() {
  const session = await auth();

  if (!session?.user) {
    // Not authenticated - redirect to signin
    redirect('/auth/signin');
  }

  // RGPD: Check if user needs to accept terms (OAuth users who bypassed signup form)
  const needsTerms = (session.user as Record<string, unknown>)?.needsTerms;
  if (needsTerms) {
    const role = (session.user as Record<string, unknown>)?.role; // Safe: session data shape from auth provider includes custom role field
    const destination = (role === 'OWNER' || role === 'EMPLOYEE' || role === 'CLIENT')
      ? '/admin'
      : '/';
    redirect(`/auth/accept-terms?callbackUrl=${encodeURIComponent(destination)}`);
  }

  const role = (session.user as Record<string, unknown>)?.role; // Safe: session data shape from auth provider includes custom role field

  if (role === 'OWNER' || role === 'EMPLOYEE' || role === 'CLIENT') {
    redirect('/admin');
  } else {
    // CUSTOMER -> page d'accueil
    redirect('/');
  }
}

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import PostLoginClientFallback from './PostLoginClientFallback';

export const metadata: Metadata = {
  title: 'Redirecting... | BioCycle Peptides',
  description: 'Processing your login and redirecting you to the appropriate page.',
  robots: { index: false, follow: false },
};

/**
 * Post-login page - Server Component with Client Fallback
 *
 * After an OAuth callback (especially Apple form_post or Microsoft), the session
 * JWT cookie may not be available on the very first server-side request due to
 * cookie propagation timing. Previously, this caused a redirect loop back to
 * /auth/signin (Apple) or required a second login attempt (Microsoft).
 *
 * FIX: If auth() returns no session server-side, render a client component that
 * polls /api/auth/session until the cookie is available, then redirects based
 * on role. This gives the browser time to process the Set-Cookie header.
 *
 * RGPD: If the user hasn't accepted Terms of Service yet (OAuth signup),
 * redirect to the accept-terms page before allowing access.
 */
export default async function PostLoginPage() {
  const session = await auth();

  if (!session?.user) {
    // Session not yet available server-side — render client fallback
    // that will poll for the session instead of redirecting to signin immediately.
    // This fixes Apple Sign In loop and Microsoft double-attempt issue.
    return <PostLoginClientFallback />;
  }

  // RGPD: Check if user needs to accept terms (OAuth users who bypassed signup form)
  const needsTerms = (session.user as Record<string, unknown>)?.needsTerms;
  if (needsTerms) {
    const role = (session.user as Record<string, unknown>)?.role;
    const destination = (role === 'OWNER' || role === 'EMPLOYEE' || role === 'CLIENT')
      ? '/admin'
      : '/';
    redirect(`/auth/accept-terms?callbackUrl=${encodeURIComponent(destination)}`);
  }

  const role = (session.user as Record<string, unknown>)?.role;

  if (role === 'OWNER' || role === 'EMPLOYEE' || role === 'CLIENT') {
    redirect('/admin');
  } else {
    // CUSTOMER -> page d'accueil
    redirect('/');
  }
}

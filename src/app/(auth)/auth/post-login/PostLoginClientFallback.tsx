'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Client-side fallback for post-login redirect.
 *
 * After OAuth callbacks (Apple form_post, Microsoft redirect), the session
 * JWT cookie may not be available on the very first server-side auth() call.
 * This component polls /api/auth/session client-side, giving the browser
 * time to process the Set-Cookie header from the Auth.js callback response.
 *
 * Polling strategy:
 * - Poll every 500ms for up to 10 seconds (20 attempts)
 * - If session is found, redirect based on user role
 * - If session is never found, redirect to signin (genuine auth failure)
 */
export default function PostLoginClientFallback() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const [failed, setFailed] = useState(false);

  const MAX_ATTEMPTS = 20;
  const POLL_INTERVAL = 500; // ms

  useEffect(() => {
    if (failed) return;

    const pollSession = async () => {
      try {
        const res = await fetch('/api/auth/session', {
          credentials: 'include',
          cache: 'no-store',
        });
        const session = await res.json();

        if (session?.user) {
          const { role, needsTerms } = session.user;

          // RGPD: Check if user needs to accept terms
          if (needsTerms) {
            const destination = (role === 'OWNER' || role === 'EMPLOYEE' || role === 'CLIENT')
              ? '/admin'
              : '/';
            router.replace(`/auth/accept-terms?callbackUrl=${encodeURIComponent(destination)}`);
            return;
          }

          // Role-based redirect
          if (role === 'OWNER' || role === 'EMPLOYEE' || role === 'CLIENT') {
            router.replace('/admin');
          } else {
            router.replace('/');
          }
          return;
        }
      } catch {
        // Network error - continue polling
      }

      const nextAttempt = attempts + 1;
      if (nextAttempt >= MAX_ATTEMPTS) {
        // Exhausted all attempts - genuine auth failure, redirect to signin
        setFailed(true);
        router.replace('/auth/signin?error=SessionTimeout');
        return;
      }

      setAttempts(nextAttempt);
    };

    const timer = setTimeout(pollSession, POLL_INTERVAL);
    return () => clearTimeout(timer);
  }, [attempts, failed, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
        <p className="mt-4 text-gray-600">
          {failed ? 'Redirecting to sign in...' : 'Completing sign in...'}
        </p>
      </div>
    </div>
  );
}

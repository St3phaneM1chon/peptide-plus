'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { Suspense } from 'react';
import { useI18n } from '@/i18n/client';

function WelcomeContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.replace('/auth/signin');
      return;
    }

    // RGPD: Check if user needs to accept terms (new OAuth users)
    const needsTerms = (session.user as Record<string, unknown>)?.needsTerms;

    // Redirect to callbackUrl if present, otherwise role-based redirect
    const callbackUrl = searchParams.get('callbackUrl');
    let destination: string;
    if (callbackUrl && callbackUrl.includes('/auth/post-login')) {
      destination = '/auth/post-login';
    } else if (callbackUrl) {
      destination = callbackUrl;
    } else {
      const role = (session.user as Record<string, unknown>)?.role;
      if (role === 'OWNER' || role === 'EMPLOYEE' || role === 'CLIENT') {
        destination = '/admin';
      } else {
        // CUSTOMER -> page d'accueil
        destination = '/';
      }
    }

    // If terms not accepted, redirect to accept-terms first
    if (needsTerms) {
      router.replace(`/auth/accept-terms?callbackUrl=${encodeURIComponent(destination)}`);
    } else {
      router.replace(destination);
    }
  }, [session, status, router, searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {t('auth.welcomeTitle')}
        </h1>
        <p className="text-gray-600 mb-6">
          {t('auth.welcomeMessage')}
        </p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-4 text-sm text-gray-500">{t('common.redirecting')}</p>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
        </div>
      }
    >
      <WelcomeContent />
    </Suspense>
  );
}

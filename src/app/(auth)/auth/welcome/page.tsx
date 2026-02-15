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

    // Redirect to callbackUrl if present, otherwise role-based redirect
    const callbackUrl = searchParams.get('callbackUrl');
    if (callbackUrl && callbackUrl.includes('/auth/post-login')) {
      router.replace('/auth/post-login');
    } else if (callbackUrl) {
      router.replace(callbackUrl);
    } else {
      const role = (session.user as Record<string, unknown>)?.role;
      if (role === 'OWNER' || role === 'EMPLOYEE' || role === 'CLIENT') {
        router.replace('/admin');
      } else {
        // CUSTOMER -> page d'accueil
        router.replace('/');
      }
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

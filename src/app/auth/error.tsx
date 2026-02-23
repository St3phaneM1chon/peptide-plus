'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';

// FAILLE-032 FIX: Use i18n instead of hardcoded English
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error('Auth error:', error.digest || 'unknown');
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.error.title')}</h2>
        <p className="text-gray-600 mb-6">
          {t('auth.error.description')}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            {t('auth.error.tryAgain')}
          </button>
          <Link
            href="/auth/signin"
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {t('auth.error.signIn')}
          </Link>
        </div>
      </div>
    </div>
  );
}

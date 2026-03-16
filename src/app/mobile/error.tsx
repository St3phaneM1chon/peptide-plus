'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';

export default function MobileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error('Mobile error boundary caught:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>

      <h1 className="text-xl font-bold text-gray-900 mb-2">
        {t('errors.somethingWentWrong')}
      </h1>
      <p className="text-sm text-gray-600 mb-1">
        {t('errors.errorDescription')}
      </p>

      {error.digest && (
        <p className="text-xs text-gray-400 mb-4">
          {t('errors.errorId').replace('{id}', error.digest)}
        </p>
      )}

      <div className="flex gap-3 mt-4">
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors min-h-[44px]"
        >
          {t('errors.retryLoading')}
        </button>
        <Link
          href="/mobile/dashboard"
          className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
        >
          {t('errors.goToHomepage')}
        </Link>
      </div>
    </div>
  );
}

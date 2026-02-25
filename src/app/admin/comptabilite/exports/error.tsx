'use client';

import { useEffect } from 'react';
import { useI18n } from '@/i18n/client';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="min-h-[40vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-5">
          <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {t('admin.errors.adminPanelError')}
        </h2>
        <p className="text-gray-600 mb-4 text-sm">
          {t('admin.errors.adminPanelErrorDesc')}
        </p>
        {error.message && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-left">
            <p className="text-xs text-red-700 font-mono break-all">{error.message}</p>
          </div>
        )}
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-sky-600 text-white rounded-lg font-medium hover:bg-sky-700 transition-colors"
          aria-label={t('admin.errors.tryAgain')}
        >
          {t('admin.errors.tryAgain')}
        </button>
      </div>
    </div>
  );
}

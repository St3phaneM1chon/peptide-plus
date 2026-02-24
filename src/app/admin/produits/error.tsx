'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';

export default function ProductsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error('Products error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center">
        {/* Error icon */}
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          {t('admin.errors.adminPanelError')}
        </h2>

        <p className="text-gray-600 mb-2">
          {t('admin.errors.adminPanelErrorDesc')}
        </p>

        {/* BUG-074 FIX: Display the actual error message so the admin can diagnose */}
        {error.message && (
          <div className="mt-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-left">
            <p className="text-xs font-semibold text-red-800 mb-1">{t('admin.errors.errorDetails') || 'Error details'}:</p>
            <p className="text-sm text-red-700 font-mono break-all">{error.message}</p>
          </div>
        )}

        {error.digest && (
          <p className="text-xs text-gray-400 mb-4">
            {t('admin.errors.errorId')}: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-sky-600 text-white rounded-lg font-semibold hover:bg-sky-700 transition-colors min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t('admin.errors.tryAgain')}
          </button>
          <Link
            href="/admin/produits"
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors min-h-[44px]"
          >
            {t('admin.products.title') || 'Products list'}
          </Link>
        </div>
      </div>
    </div>
  );
}

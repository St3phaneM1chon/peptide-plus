'use client';

/**
 * Auth Error Boundary - Catches errors in authentication pages.
 * Renders within the auth layout.
 */

import { useI18n } from '@/i18n/client';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="max-w-sm text-center">
        <h1 className="mb-3 text-xl font-bold text-gray-900">
          {t('errors.somethingWentWrong')}
        </h1>
        <p className="mb-6 text-gray-600">
          {t('errors.errorDescription')}
        </p>
        {error.digest && (
          <p className="mb-4 text-xs text-gray-400">
            {t('errors.errorId').replace('{id}', error.digest)}
          </p>
        )}
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors"
          >
            {t('errors.retryLoading')}
          </button>
          <a
            href="/auth/signin"
            className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {t('common.backToHome')}
          </a>
        </div>
      </div>
    </div>
  );
}

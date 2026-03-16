'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('errors.somethingWentWrong')}</h2>
      <p className="text-gray-600 mb-2">{t('errors.errorDescription')}</p>
      {error.digest && (
        <p className="text-xs text-gray-400 mb-6">
          {t('errors.errorId').replace('{id}', error.digest)}
        </p>
      )}
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
        >
          {t('errors.retryLoading')}
        </button>
        <Link href="/dashboard" className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
          {t('errors.goToHomepage')}
        </Link>
      </div>
    </div>
  );
}

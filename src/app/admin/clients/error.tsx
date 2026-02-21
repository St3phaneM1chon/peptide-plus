'use client';

import { useEffect } from 'react';
import { useI18n } from '@/i18n/client';

export default function ClientsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error('Clients error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('admin.errors.adminPanelError')}</h2>
        <p className="text-gray-600 mb-4">
          {t('admin.errors.adminPanelErrorDesc')}
          {error.digest && (
            <span className="block text-sm text-gray-400 mt-1">
              {t('admin.errors.errorId')}: {error.digest}
            </span>
          )}
        </p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
        >
          {t('admin.errors.tryAgain')}
        </button>
      </div>
    </div>
  );
}

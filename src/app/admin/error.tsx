'use client';

import { useEffect } from 'react';
import { useI18n } from '@/i18n/client';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    // Client-side error logging (server logger not available in 'use client')
    console.error('[Admin Error]', error.message, error.digest);
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
          className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          {t('admin.errors.tryAgain')}
        </button>
      </div>
    </div>
  );
}

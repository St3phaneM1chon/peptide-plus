'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/client';

export default function MobileNotFound() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
      <h1 className="text-5xl font-bold text-gray-300 mb-3">404</h1>
      <h2 className="text-xl font-semibold mb-2">{t('common.pageNotFound')}</h2>
      <p className="text-sm text-gray-500 mb-6">{t('common.pageNotFoundDescription')}</p>
      <Link
        href="/mobile/dashboard"
        className="px-5 py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors min-h-[44px]"
      >
        {t('common.backToHome')}
      </Link>
    </div>
  );
}

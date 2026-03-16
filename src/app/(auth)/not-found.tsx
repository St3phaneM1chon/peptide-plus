'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/client';

export default function AuthNotFound() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h1 className="text-5xl font-bold text-gray-300 mb-3">404</h1>
      <h2 className="text-xl font-semibold mb-2">{t('common.pageNotFound')}</h2>
      <p className="text-gray-500 mb-6">{t('common.pageNotFoundDescription')}</p>
      <Link
        href="/auth/signin"
        className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
      >
        {t('common.backToHome')}
      </Link>
    </div>
  );
}

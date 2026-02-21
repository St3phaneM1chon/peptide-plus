'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/client';

export default function AdminNotFound() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h1 className="text-6xl font-bold text-gray-200 mb-4">404</h1>
      <h2 className="text-xl font-semibold mb-2">{t('common.pageNotFound')}</h2>
      <p className="text-gray-500 mb-6">{t('common.pageNotFoundDescription')}</p>
      <Link href="/admin/dashboard" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
        {t('common.backToDashboard')}
      </Link>
    </div>
  );
}

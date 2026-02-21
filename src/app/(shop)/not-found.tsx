'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/client';

export default function ShopNotFound() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-2">{t('common.pageNotFound')}</h2>
      <p className="text-gray-500 mb-8">{t('common.pageNotFoundDescription')}</p>
      <Link href="/shop" className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
        {t('common.backToShop')}
      </Link>
    </div>
  );
}

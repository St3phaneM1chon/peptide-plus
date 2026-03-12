'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/client';

export default function ProductNotFound() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <h2 className="text-2xl font-bold mb-4">{t('shop.productNotFound.title')}</h2>
      <p className="text-gray-600 mb-6">
        {t('shop.productNotFound.description')}
      </p>
      <Link
        href="/catalogue"
        className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
      >
        {t('shop.productNotFound.browseCatalog')}
      </Link>
    </div>
  );
}

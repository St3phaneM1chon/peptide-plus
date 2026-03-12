'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error('Checkout error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <h2 className="text-2xl font-bold mb-4">{t('shop.checkoutError.title')}</h2>
      <p className="text-gray-600 mb-6">
        {t('shop.checkoutError.cartSafe')}
      </p>
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          {t('shop.checkoutError.tryAgain')}
        </button>
        <Link
          href="/"
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {t('shop.checkoutError.returnToShop')}
        </Link>
      </div>
    </div>
  );
}

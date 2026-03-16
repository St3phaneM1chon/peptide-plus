'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import { useCurrency } from '@/contexts/CurrencyContext';

interface CompactProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  imageUrl?: string;
  category?: string;
  inStock?: boolean;
}

interface ProductListCompactProps {
  products: CompactProduct[];
}

export default function ProductListCompact({ products }: ProductListCompactProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();

  if (!products.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {products.map((product) => (
        <Link
          key={product.id}
          href={`/product/${product.slug}`}
          className="group flex items-center gap-4 bg-white rounded-xl p-4 border border-neutral-200 hover:shadow-md hover:border-primary-200 transition-all"
        >
          {/* Thumbnail */}
          <div className="w-16 h-16 rounded-lg bg-neutral-100 overflow-hidden shrink-0">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <svg className="w-8 h-8 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-neutral-900 truncate group-hover:text-primary-600 transition-colors">
              {product.name}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-semibold text-primary-700">{formatPrice(product.price)}</span>
              {product.inStock !== false && (
                <span className="text-xs text-primary-600">{t('shop.inStock') || 'In Stock'}</span>
              )}
            </div>
          </div>

          {/* Arrow */}
          <svg className="w-4 h-4 text-neutral-400 group-hover:text-primary-500 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      ))}
    </div>
  );
}

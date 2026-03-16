'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import { useCurrency } from '@/contexts/CurrencyContext';

interface ProductCardFeaturedProps {
  id: string;
  name: string;
  slug: string;
  price: number;
  purity?: number;
  imageUrl?: string;
  category?: string;
  formats?: {
    id: string;
    name: string;
    price: number;
    comparePrice?: number;
    inStock: boolean;
  }[];
}

export default function ProductCardFeatured({
  name,
  slug,
  price,
  purity,
  imageUrl,
  category,
  formats = [],
}: ProductCardFeaturedProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const hasCompare = formats.some((f) => f.comparePrice && f.comparePrice > f.price);
  const lowestCompare = hasCompare
    ? Math.min(...formats.filter((f) => f.comparePrice).map((f) => f.comparePrice!))
    : undefined;

  return (
    <Link
      href={`/product/${slug}`}
      className="group grid grid-cols-1 md:grid-cols-2 gap-0 bg-white rounded-2xl overflow-hidden border border-neutral-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
    >
      {/* Image */}
      <div className="relative aspect-square md:aspect-auto bg-neutral-100 overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="flex items-center justify-center h-full" role="img" aria-label={name}>
            <svg className="w-20 h-20 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" />
            </svg>
          </div>
        )}
        {/* Category ribbon */}
        {category && (
          <span className="absolute top-4 start-4 px-3 py-1 bg-secondary-500 text-white text-xs font-semibold uppercase tracking-wider rounded-full">
            {category}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col justify-center p-6 md:p-8">
        <h3 className="font-heading text-2xl text-neutral-900 mb-3 group-hover:text-primary-600 transition-colors">
          {name}
        </h3>

        {purity && (
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex items-center px-2.5 py-0.5 bg-primary-50 text-primary-700 text-sm font-medium rounded-full">
              {purity}% {t('shop.purity') || 'Purity'}
            </span>
          </div>
        )}

        <div className="flex items-baseline gap-3 mb-6">
          <span className="text-2xl font-bold text-primary-700">
            {formatPrice(price)}
          </span>
          {lowestCompare && (
            <span className="text-lg text-neutral-400 line-through">
              {formatPrice(lowestCompare)}
            </span>
          )}
        </div>

        <span className="inline-flex items-center gap-2 text-primary-600 font-semibold group-hover:gap-3 transition-all">
          {t('shop.viewProduct') || 'View Product'}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from '@/hooks/useTranslations';
import { useCurrency } from '@/contexts/CurrencyContext';

interface BundleCardProps {
  bundle: {
    slug: string;
    name: string;
    description?: string | null;
    image?: string | null;
    discount: number;
    itemCount: number;
    originalPrice: number;
    bundlePrice: number;
    savings: number;
    items: Array<{
      product: {
        name: string;
        imageUrl?: string | null;
      };
    }>;
  };
}

export default function BundleCard({ bundle }: BundleCardProps) {
  const { t } = useTranslations();
  const { formatPrice } = useCurrency();

  return (
    <Link
      href={`/bundles/${bundle.slug}`}
      className="group block bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300"
    >
      {/* Bundle Image */}
      <div className="relative aspect-square bg-gray-100">
        {bundle.image ? (
          <Image
            src={bundle.image}
            alt={bundle.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-16 h-16"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
              />
            </svg>
          </div>
        )}

        {/* Savings Badge */}
        {bundle.discount > 0 && (
          <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-md">
            {t('shop.savePercent').replace('{percent}', String(bundle.discount))}
          </div>
        )}
      </div>

      {/* Bundle Info */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
          {bundle.name}
        </h3>

        {bundle.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {bundle.description}
          </p>
        )}

        {/* Item Count */}
        <div className="text-sm text-gray-500 mb-3">
          {bundle.itemCount === 1
            ? t('shop.productIncluded').replace('{count}', '1')
            : t('shop.productsIncluded').replace('{count}', String(bundle.itemCount))}
        </div>

        {/* Mini Product Thumbnails */}
        <div className="flex gap-2 mb-4 overflow-hidden">
          {bundle.items.slice(0, 4).map((item, idx) => (
            <div
              key={idx}
              className="w-12 h-12 rounded border border-gray-200 bg-gray-50 flex-shrink-0 relative"
            >
              {item.product.imageUrl ? (
                <Image
                  src={item.product.imageUrl}
                  alt={item.product.name}
                  fill
                  className="object-cover rounded"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                    />
                  </svg>
                </div>
              )}
            </div>
          ))}
          {bundle.items.length > 4 && (
            <div className="w-12 h-12 rounded border border-gray-200 bg-gray-100 flex-shrink-0 flex items-center justify-center text-xs text-gray-500 font-medium">
              +{bundle.items.length - 4}
            </div>
          )}
        </div>

        {/* Price Comparison */}
        <div className="border-t pt-3">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm text-gray-500 line-through">
              {formatPrice(bundle.originalPrice)}
            </span>
            <span className="text-2xl font-bold text-blue-600">
              {formatPrice(bundle.bundlePrice)}
            </span>
          </div>
          <div className="text-sm text-green-600 font-medium text-right">
            {t('shop.youSave').replace('{amount}', formatPrice(bundle.savings))}
          </div>
        </div>
      </div>
    </Link>
  );
}

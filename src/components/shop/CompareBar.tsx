'use client';

import { useEffect, useState } from 'react';
import { useCompare } from '@/hooks/useCompare';
import { useTranslations } from '@/hooks/useTranslations';
import Link from 'next/link';
import Image from 'next/image';

interface CompareProduct {
  slug: string;
  name: string;
  imageUrl: string | null;
}

export default function CompareBar() {
  const { productSlugs, count, removeFromCompare, clearCompare, getCompareUrl } = useCompare();
  const { t, locale } = useTranslations();
  const [products, setProducts] = useState<CompareProduct[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch product details when slugs change
  useEffect(() => {
    if (productSlugs.length === 0) {
      setProducts([]);
      setIsVisible(false);
      return;
    }

    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/products/compare?slugs=${productSlugs.join(',')}&locale=${locale}`);
        if (response.ok) {
          const data = await response.json();
          setProducts(data.products || []);
          setIsVisible(true);
        }
      } catch (error) {
        console.error('Failed to fetch compare products:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [productSlugs]);

  // Listen for compare updates from other components
  useEffect(() => {
    const handleCompareUpdate = () => {
      // Trigger re-fetch by updating productSlugs dependency
      // (already handled by useCompare hook)
    };

    window.addEventListener('compareUpdated', handleCompareUpdate);
    return () => window.removeEventListener('compareUpdated', handleCompareUpdate);
  }, []);

  if (!isVisible || count === 0) {
    return null;
  }

  const compareUrl = getCompareUrl();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-orange-500 shadow-2xl animate-slide-up">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Title & Product Count */}
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
              {count}
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-sm">{t('compare.compareProducts')}</h3>
              <p className="text-xs text-neutral-500">
                {count < 2
                  ? t('compare.addMoreToCompare')
                  : t('compare.readyToCompare', { count: count.toString() })
                }
              </p>
            </div>
          </div>

          {/* Middle: Product Thumbnails (scrollable on mobile) */}
          <div className="flex-1 flex items-center gap-2 overflow-x-auto max-w-md">
            {isLoading ? (
              <div className="flex gap-2">
                {Array.from({ length: count }).map((_, i) => (
                  <div key={i} className="w-12 h-12 bg-neutral-200 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              products.map((product) => (
                <div
                  key={product.slug}
                  className="relative group flex-shrink-0"
                >
                  <div className="w-12 h-12 bg-neutral-100 rounded-lg overflow-hidden border border-neutral-200">
                    <Image
                      src={product.imageUrl || '/images/products/peptide-default.png'}
                      alt={product.name}
                      width={48}
                      height={48}
                      className="object-cover w-full h-full"
                    />
                  </div>
                  {/* Remove button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      removeFromCompare(product.slug);
                    }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                    aria-label={`Remove ${product.name}`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {compareUrl && count >= 2 && (
              <Link
                href={compareUrl}
                className="bg-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 transition-colors text-sm whitespace-nowrap"
              >
                {t('compare.compareNow')}
              </Link>
            )}
            <button
              onClick={clearCompare}
              className="text-neutral-500 hover:text-red-500 p-2 transition-colors"
              aria-label={t('compare.clearAll')}
              title={t('compare.clearAll')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

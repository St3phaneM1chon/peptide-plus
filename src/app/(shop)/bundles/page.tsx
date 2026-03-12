'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import BundleCard from '@/components/shop/BundleCard';

interface Bundle {
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
}

export default function BundlesPage() {
  const { t } = useTranslations();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBundles() {
      try {
        const response = await fetch('/api/bundles');
        if (!response.ok) throw new Error('Failed to fetch bundles');
        const data = await response.json();
        setBundles(data);
      } catch (err) {
        console.error('Error fetching bundles:', err);
        setError(t('bundles.failedToLoad'));
      } finally {
        setLoading(false);
      }
    }

    fetchBundles();
  }, [t]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="text-center text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-teal-700 via-teal-600 to-teal-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('bundles.title')}
          </h1>
          <p className="text-xl text-teal-100 max-w-2xl mx-auto">
            {t('bundles.subtitle')}
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Bundles Grid */}
        {bundles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {bundles.map((bundle) => (
              <BundleCard key={bundle.slug} bundle={bundle} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-24 h-24 mx-auto text-gray-300 mb-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {t('bundles.noBundlesTitle')}
            </h3>
            <p className="text-gray-600 mb-6">
              {t('bundles.noBundlesText')}
            </p>
            <a
              href="/shop"
              className="inline-block bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition-colors font-medium"
            >
              {t('bundles.shopAll')}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

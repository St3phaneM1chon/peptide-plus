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
        setError('Failed to load bundles');
      } finally {
        setLoading(false);
      }
    }

    fetchBundles();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          Product Bundles & Kits
        </h1>
        <p className="text-lg text-gray-600">
          Save more with our pre-configured product bundles. Get everything you need at a discounted price.
        </p>
      </div>

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
            No bundles available yet
          </h3>
          <p className="text-gray-600 mb-6">
            Check back soon for exciting product bundles and special offers.
          </p>
          <a
            href="/products"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Shop All Products
          </a>
        </div>
      )}
    </div>
  );
}

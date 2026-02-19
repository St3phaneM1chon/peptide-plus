'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { useI18n } from '@/i18n/client';
import { useCurrency } from '@/contexts/CurrencyContext';

interface RecentProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  imageUrl?: string;
  purity?: number;
}

interface RecentlyViewedProps {
  /** Slug to exclude (e.g. current product page) */
  excludeSlug?: string;
}

const MAX_SHOWN = 8;

export default function RecentlyViewed({ excludeSlug }: RecentlyViewedProps) {
  const { recentSlugs } = useRecentlyViewed();
  const { t, locale } = useI18n();
  const { formatPrice } = useCurrency();

  const [products, setProducts] = useState<RecentProduct[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter out the excluded slug and limit to MAX_SHOWN
  const slugsToFetch = recentSlugs
    .filter((s) => s !== excludeSlug)
    .slice(0, MAX_SHOWN);

  useEffect(() => {
    if (slugsToFetch.length === 0) {
      setProducts([]);
      return;
    }

    let cancelled = false;

    async function fetchProducts() {
      setLoading(true);
      try {
        // Fetch only the specific products by slugs (not the full catalog)
        const slugsParam = slugsToFetch.join(',');
        const res = await fetch(`/api/products?slugs=${encodeURIComponent(slugsParam)}&locale=${locale}`);
        if (!res.ok) throw new Error('Failed to fetch products');
        const data = await res.json();
        const fetchedProducts = Array.isArray(data) ? data : data.products || data.data?.products || data.data || [];

        // Build a map for quick lookup
        const productMap = new Map<string, RecentProduct>();
        for (const p of fetchedProducts) {
          // Compute lowest price from formats
          const activeFormats = (p.formats || []).filter((f: { isActive: boolean }) => f.isActive);
          const lowestPrice = activeFormats.length > 0
            ? Math.min(...activeFormats.map((f: { price: number | string }) => Number(f.price)))
            : Number(p.price) || 0;

          // Get primary image
          const primaryImage = p.images?.find((img: { isPrimary?: boolean }) => img.isPrimary) || p.images?.[0];
          const imageUrl = primaryImage?.url || p.imageUrl || undefined;

          productMap.set(p.slug, {
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: lowestPrice,
            imageUrl,
            purity: p.purity ? Number(p.purity) : undefined,
          });
        }

        // Maintain the order from slugsToFetch (most recent first)
        const ordered: RecentProduct[] = [];
        for (const slug of slugsToFetch) {
          const product = productMap.get(slug);
          if (product) {
            ordered.push(product);
          }
        }

        if (!cancelled) {
          setProducts(ordered);
        }
      } catch (err) {
        console.error('Error fetching recently viewed products:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchProducts();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slugsToFetch.join(',')]);

  // Don't render anything if no products to show
  if (!loading && products.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 border-t pt-8">
      <h2 className="text-2xl font-bold mb-6">{t('shop.recentlyViewed')}</h2>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: Math.min(4, slugsToFetch.length) }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-48 animate-pulse">
              <div className="bg-neutral-200 rounded-lg aspect-square mb-3" />
              <div className="bg-neutral-200 h-4 rounded w-3/4 mb-2" />
              <div className="bg-neutral-200 h-4 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/product/${product.slug}`}
              className="flex-shrink-0 w-48 bg-white border border-neutral-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow group"
            >
              {/* Image */}
              <div className="relative aspect-square bg-neutral-100">
                <Image
                  src={product.imageUrl || '/images/products/peptide-default.png'}
                  alt={product.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="192px"
                />
              </div>

              {/* Content */}
              <div className="p-3">
                <h3 className="font-medium text-sm text-black group-hover:text-orange-600 transition-colors line-clamp-2">
                  {product.name}
                </h3>
                {product.purity && (
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {t('shop.purity')} {product.purity}%
                  </p>
                )}
                <p className="text-orange-600 font-bold mt-1">
                  {formatPrice(product.price)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

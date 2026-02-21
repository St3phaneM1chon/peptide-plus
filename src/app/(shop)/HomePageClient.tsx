'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { ProductCard, TrustBadges } from '@/components/shop';
import { TrustBadgesHero } from '@/components/shop/TrustBadges';
import HeroSlider from '@/components/shop/HeroSlider';
import { useI18n } from '@/i18n/client';

const PeptideCalculator = dynamic(() => import('@/components/shop/PeptideCalculator'), {
  loading: () => <div className="animate-pulse h-48 bg-gray-100 rounded-xl" />,
  ssr: false,
});

interface ApiProduct {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  purity?: number;
  molecularWeight?: string;
  isActive: boolean;
  isFeatured: boolean;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  images?: Array<{
    url: string;
    alt?: string;
  }>;
  formats: Array<{
    id: string;
    label: string;
    type?: string;
    price: number | string;
    compareAtPrice?: number | string;
    isActive: boolean;
    stockQuantity: number;
    imageUrl?: string;
  }>;
  createdAt: string;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  imageUrl: string | null;
  author: string | null;
  category: string | null;
  readTime: number | null;
  publishedAt: string | null;
}

// Map API product to ProductCard props
const newThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

function toCardProps(p: ApiProduct) {
  const activeFormats = p.formats.filter((f) => f.isActive);
  const lowestPrice = activeFormats.length > 0
    ? Math.min(...activeFormats.map((f) => Number(f.price)))
    : 0;
  const hasStock = activeFormats.some((f) => f.stockQuantity > 0);

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: lowestPrice,
    purity: p.purity ? Number(p.purity) : undefined,
    imageUrl: p.imageUrl || p.images?.[0]?.url || undefined,
    category: p.category?.name || '',
    isNew: new Date(p.createdAt) > newThreshold,
    isBestseller: p.isFeatured,
    inStock: hasStock,
    formats: activeFormats.map((f) => ({
      id: f.id,
      name: f.label,
      price: Number(f.price),
      comparePrice: f.compareAtPrice ? Number(f.compareAtPrice) : undefined,
      inStock: f.stockQuantity > 0,
      stockQuantity: f.stockQuantity,
      image: f.imageUrl || undefined,
    })),
  };
}

// Testimonials
const testimonials = [
  {
    quote: "Been using Peptide Plus for a year now. In my opinion, it's the best source in Canada. Quality product everytime and gives me the best results. Also the communication is second to none.",
    author: '@ResearchPro',
    source: 'Verified Buyer',
  },
  {
    quote: "Ordered my kit on the 2nd, received tracking 2 hours later and got my package on the 4th. Remarkable service. I already feel these are better than others I've been using.",
    author: '@LabTester',
    source: 'Verified Buyer',
  },
  {
    quote: "A+ service and communication. Delivery is always quick and packaged safe and sound. I love how they're transparent and also have lab results to back up their batches.",
    author: '@QualityFirst',
    source: 'Verified Buyer',
  },
];

interface HomePageProps {
  initialHeroSlides?: HeroSlideData[];
}

// Re-export the HeroSlide type for parent components
export interface HeroSlideData {
  id: string;
  slug: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'ANIMATION';
  backgroundUrl: string;
  backgroundMobile?: string | null;
  overlayOpacity: number;
  overlayGradient?: string | null;
  badgeText?: string | null;
  title: string;
  subtitle?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  ctaStyle?: string | null;
  cta2Text?: string | null;
  cta2Url?: string | null;
  cta2Style?: string | null;
  statsJson?: string | null;
  translations: {
    locale: string;
    badgeText?: string | null;
    title: string;
    subtitle?: string | null;
    ctaText?: string | null;
    cta2Text?: string | null;
    statsJson?: string | null;
  }[];
}

export default function HomePage({ initialHeroSlides }: HomePageProps) {
  const { t, locale } = useI18n();
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    setFetchError(false);
    Promise.all([
      fetch(`/api/products?locale=${locale}&limit=200`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data) {
            const list = Array.isArray(data) ? data : data.products || data.data?.products || data.data || [];
            setProducts(list.filter((p: ApiProduct) => p.isActive));
          }
        })
        .catch(() => { setFetchError(true); })
        .finally(() => setLoading(false)),

      fetch(`/api/articles?category=Résultats de Recherche&locale=${locale}&limit=4`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data?.articles) {
            setArticles(data.articles);
          }
        })
        .catch(() => { setFetchError(true); })
        .finally(() => setArticlesLoading(false)),
    ]);
  }, [locale]);

  // Generic helper to filter products by category slugs and convert to card props
  const filterByCategory = (allProducts: ApiProduct[], slugs: string[], limit = 4) => {
    if (!allProducts || allProducts.length === 0) return [];
    return allProducts
      .filter((p) => p.category && slugs.includes(p.category.slug))
      .slice(0, limit)
      .map(toCardProps);
  };

  // Peptide products
  const peptideProducts = useMemo(
    () => filterByCategory(products, ['anti-aging-longevity', 'weight-loss', 'skin-health', 'sexual-health', 'cognitive-health', 'growth-metabolism', 'muscle-growth', 'recovery-repair', 'peptides']),
    [products]
  );

  // Accessory products
  const accessoryProducts = useMemo(
    () => filterByCategory(products, ['lab-accessories', 'accessories']),
    [products]
  );

  // Lab equipment products
  const labEquipmentProducts = useMemo(
    () => filterByCategory(products, ['lab-equipment', 'laboratory-equipment']),
    [products]
  );

  const ProductSkeleton = () => (
    <div className="animate-pulse">
      <div className="bg-neutral-200 rounded-lg aspect-square mb-3" />
      <div className="bg-neutral-200 h-4 rounded w-3/4 mb-2" />
      <div className="bg-neutral-200 h-4 rounded w-1/2" />
    </div>
  );

  const ArticleSkeleton = () => (
    <div className="animate-pulse bg-white rounded-xl overflow-hidden">
      <div className="bg-neutral-200 h-44" />
      <div className="p-5">
        <div className="bg-neutral-200 h-4 rounded w-3/4 mb-3" />
        <div className="bg-neutral-200 h-3 rounded w-full mb-2" />
        <div className="bg-neutral-200 h-3 rounded w-2/3" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Slider */}
      <HeroSlider initialSlides={initialHeroSlides} />

      {/* Trust Badges Hero */}
      <TrustBadgesHero />

      {/* Fetch Error */}
      {fetchError && !loading && (
        <div className="max-w-7xl mx-auto px-4 py-6 text-center">
          <p className="text-red-600 mb-2">{t('common.fetchError') || 'Failed to load content.'}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
          >
            {t('common.retry') || 'Retry'}
          </button>
        </div>
      )}

      {/* Section 1: Résultats de Recherche (Articles) */}
      {(articlesLoading || articles.length > 0) && (
        <section className="py-16 bg-neutral-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold">{t('home.researchResultsSection')}</h2>
                <p className="text-neutral-600 mt-1">{t('home.researchResultsDesc')}</p>
              </div>
              <Link
                href="/blog"
                className="text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-1"
              >
                {t('shop.viewAll')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {articlesLoading ? (
                Array.from({ length: 4 }).map((_, i) => <ArticleSkeleton key={i} />)
              ) : (
                articles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/blog/${article.slug}`}
                    className="group bg-white rounded-xl overflow-hidden shadow-sm border border-neutral-200 hover:shadow-md transition-shadow"
                  >
                    <div className="h-44 bg-neutral-100 flex items-center justify-center overflow-hidden">
                      {article.imageUrl ? (
                        <Image
                          src={article.imageUrl}
                          alt={article.title}
                          width={400}
                          height={176}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <span className="text-5xl">🔬</span>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="font-semibold text-neutral-900 mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors">
                        {article.title}
                      </h3>
                      {article.excerpt && (
                        <p className="text-sm text-neutral-500 line-clamp-2 mb-3">
                          {article.excerpt}
                        </p>
                      )}
                      <span className="text-sm text-orange-600 font-medium">
                        {t('home.readMore')} →
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* Section 2: Peptides de recherche */}
      {(loading || peptideProducts.length > 0) && (
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold">{t('home.peptidesSection')}</h2>
                <p className="text-neutral-600 mt-1">{t('home.peptidesDesc')}</p>
              </div>
              <Link
                href="/category/peptides"
                className="text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-1"
              >
                {t('shop.viewAll')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 overflow-visible">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)
              ) : (
                peptideProducts.map((product) => (
                  <div key={product.id} className="overflow-visible h-full">
                    <ProductCard {...product} />
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* Section 3: Accessoires */}
      {(loading || accessoryProducts.length > 0) && (
        <section className="py-16 bg-neutral-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold">{t('home.accessoriesSection')}</h2>
                <p className="text-neutral-600 mt-1">{t('home.accessoriesDesc')}</p>
              </div>
              <Link
                href="/category/lab-accessories"
                className="text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-1"
              >
                {t('shop.viewAll')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 overflow-visible">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)
              ) : (
                accessoryProducts.map((product) => (
                  <div key={product.id} className="overflow-visible h-full">
                    <ProductCard {...product} />
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* Section 4: Matériel de Laboratoire */}
      {(loading || labEquipmentProducts.length > 0) && (
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-3xl font-bold">{t('home.labEquipmentSection')}</h2>
                <p className="text-neutral-600 mt-1">{t('home.labEquipmentDesc')}</p>
              </div>
              <Link
                href="/category/lab-equipment"
                className="text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-1"
              >
                {t('shop.viewAll')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 overflow-visible">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)
              ) : (
                labEquipmentProducts.map((product) => (
                  <div key={product.id} className="overflow-visible h-full">
                    <ProductCard {...product} />
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {/* About Section */}
      <section className="py-16 bg-neutral-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">{t('home.aboutTitle')}</h2>
          <p className="text-lg text-neutral-300 leading-relaxed">
            {t('home.aboutText')}
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">{t('home.testimonialsTitle')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
                <div className="text-4xl text-orange-500 mb-4">&ldquo;</div>
                <p className="text-neutral-700 mb-4 leading-relaxed">
                  {testimonial.quote}
                </p>
                <div className="border-t border-neutral-200 pt-4">
                  <p className="font-bold text-neutral-900">{testimonial.author}</p>
                  <p className="text-sm text-neutral-500">{testimonial.source}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Peptide Calculator */}
      <section className="py-16">
        <div id="calculator" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-8">{t('home.calculatorTitle')}</h2>
          <PeptideCalculator />
        </div>
      </section>

      {/* Trust Badges Section */}
      <section className="py-12 bg-neutral-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <TrustBadges variant="horizontal" showAll={true} />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-black text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">{t('home.ctaTitle')}</h2>
          <p className="text-neutral-400 mb-8">
            {t('home.ctaText')}
          </p>
          <Link
            href="/shop"
            className="inline-block px-8 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
          >
            {t('shop.shopNow')}
          </Link>
        </div>
      </section>
    </div>
  );
}

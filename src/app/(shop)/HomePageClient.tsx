'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import ProductCard from '@/components/shop/ProductCard';
import ProductCardFeatured from '@/components/shop/ProductCardFeatured';
import ProductCarousel from '@/components/shop/ProductCarousel';
import ProductListCompact from '@/components/shop/ProductListCompact';
import TrustBadges, { TrustBadgesHero } from '@/components/shop/TrustBadges';
import HeroSlider from '@/components/shop/HeroSlider';
import ScienceStorySection from '@/components/shop/ScienceStorySection';
import SectionDivider from '@/components/ui/SectionDivider';
import MoleculeBackground from '@/components/ui/MoleculeBackground';
import { useI18n } from '@/i18n/client';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

const PeptideCalculator = dynamic(() => import('@/components/shop/PeptideCalculator'), {
  loading: () => <div className="animate-pulse h-48 bg-neutral-100 rounded-xl" />,
  ssr: false,
});

const VideoPlacementWidget = dynamic(() => import('@/components/content/VideoPlacementWidget'), {
  loading: () => <div className="animate-pulse h-48 bg-neutral-100 rounded-xl" />,
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

// Star rating component for testimonials — uses amber-400 for stars
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 mb-3" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-5 h-5 ${star <= rating ? 'text-amber-400' : 'text-neutral-300'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export interface TestimonialData {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  content: string;
  rating: number;
  imageUrl: string | null;
  locale: string;
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: number;
  translations: {
    locale: string;
    content: string | null;
    role: string | null;
  }[];
}

interface HomePageProps {
  initialHeroSlides?: HeroSlideData[];
  initialTestimonials?: TestimonialData[];
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

export default function HomePage({ initialHeroSlides, initialTestimonials = [] }: HomePageProps) {
  const { t, locale } = useI18n();
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Scroll animation refs
  const [articlesRef, articlesVisible] = useIntersectionObserver<HTMLElement>();
  const [peptidesRef, peptidesVisible] = useIntersectionObserver<HTMLElement>();
  const [accessoriesRef, accessoriesVisible] = useIntersectionObserver<HTMLElement>();
  const [labRef, labVisible] = useIntersectionObserver<HTMLElement>();
  const [videoRef, videoVisible] = useIntersectionObserver<HTMLElement>();
  const [testimonialsRef, testimonialsVisible] = useIntersectionObserver<HTMLElement>();
  const [ctaRef, ctaVisible] = useIntersectionObserver<HTMLElement>();

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

  // Peptide products (show up to 6)
  const featuredPeptides = useMemo(
    () => filterByCategory(products, ['anti-aging-longevity', 'weight-loss', 'skin-health', 'sexual-health', 'cognitive-health', 'growth-metabolism', 'muscle-growth', 'recovery-repair', 'peptides'], 6),
    [products]
  );

  // Accessory products
  const accessoryProducts = useMemo(
    () => filterByCategory(products, ['lab-accessories', 'accessories'], 8),
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

      {/* 1. Hero Slider (carousel) — directement sous la nav, aucun logo/tagline entre les deux */}
      <HeroSlider initialSlides={initialHeroSlides} />

      {/* 3. Trust Bar — directement sous le slider, SANS degrade */}
      <section className="bg-blue-50 border-y border-blue-100">
        <TrustBadgesHero />
      </section>

      {/* Fetch Error */}
      {fetchError && !loading && (
        <div className="max-w-7xl mx-auto px-4 py-6 text-center">
          <p className="text-red-600 mb-2">{t('common.fetchError')}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
            aria-label={t('common.retry') || 'Retry loading'}
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* 4. Featured Peptides (up to 6, 3-col grid if 3+) */}
      {(loading || featuredPeptides.length > 0) && (
        <section ref={peptidesRef} className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className={`flex justify-between items-center mb-10 transition-all duration-700 ${peptidesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <div>
                <h2 className="font-heading text-3xl md:text-4xl text-neutral-900">
                  {t('home.featuredPeptides') || t('home.peptidesSection')}
                </h2>
                <p className="text-neutral-500 mt-2">{t('home.featuredPeptidesDesc') || t('home.peptidesDesc')}</p>
              </div>
              <Link
                href="/category/peptides"
                className="text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1"
              >
                {t('shop.viewAll')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-700 delay-200 ${peptidesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <ProductSkeleton key={i} />)
              ) : featuredPeptides.length <= 2 ? (
                <div className="col-span-full grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {featuredPeptides.map((product) => (
                    <ProductCardFeatured key={product.id} {...product} />
                  ))}
                </div>
              ) : (
                featuredPeptides.map((product) => (
                  <ProductCard key={product.id} {...product} />
                ))
              )}
            </div>
          </div>
        </section>
      )}

      <SectionDivider fromColor="#FFFFFF" toColor="#FAFAF9" variant="wave" />

      {/* 5. Testimonials (monte juste apres les produits) */}
      <section ref={testimonialsRef} className="py-16 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className={`font-heading text-3xl md:text-4xl text-center text-neutral-900 mb-12 transition-all duration-700 ${testimonialsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            {t('home.testimonialsTitle')}
          </h2>

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 transition-all duration-700 delay-200 ${testimonialsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {initialTestimonials.length > 0 ? (
              initialTestimonials.slice(0, 3).map((testimonial) => {
                const translation = testimonial.translations.find((tr) => tr.locale === locale);
                const displayContent = translation?.content || testimonial.content;
                const displayRole = translation?.role || testimonial.role;

                return (
                  <div key={testimonial.id} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <StarRating rating={testimonial.rating} />
                    <p className="text-neutral-700 mb-4 leading-relaxed">
                      &ldquo;{displayContent}&rdquo;
                    </p>
                    <div className="pt-4 flex items-center gap-3">
                      {testimonial.imageUrl && (
                        <Image
                          src={testimonial.imageUrl}
                          alt={testimonial.name}
                          width={40}
                          height={40}
                          className="rounded-full object-cover"
                        />
                      )}
                      <div>
                        <p className="font-bold text-neutral-900">{testimonial.name}</p>
                        {displayRole && (
                          <p className="text-sm text-neutral-500">{displayRole}{testimonial.company ? ` - ${testimonial.company}` : ''}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              [1, 2, 3].map((index) => (
                <div key={index} className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                  <StarRating rating={5} />
                  <p className="text-neutral-700 mb-4 leading-relaxed">
                    &ldquo;{t(`home.testimonial${index}Quote`)}&rdquo;
                  </p>
                  <div className="pt-4">
                    <p className="font-bold text-neutral-900">{t(`home.testimonial${index}Author`)}</p>
                    <p className="text-sm text-neutral-500">{t(`home.testimonial${index}Source`)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <SectionDivider fromColor="#FAFAF9" toColor="#F3F9F4" variant="curve" />

      {/* 6. Science Story */}
      <ScienceStorySection />

      <SectionDivider fromColor="#F3F9F4" toColor="#FAFAF9" variant="wave" />

      {/* 7. Research Articles (magazine layout) */}
      {(articlesLoading || articles.length > 0) && (
        <section ref={articlesRef} className="py-16 bg-neutral-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className={`flex justify-between items-center mb-10 transition-all duration-700 ${articlesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <div>
                <h2 className="font-heading text-3xl md:text-4xl text-neutral-900">{t('home.researchResultsSection')}</h2>
                <p className="text-neutral-500 mt-2">{t('home.researchResultsDesc')}</p>
              </div>
              <Link
                href="/blog"
                className="text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1"
              >
                {t('shop.viewAll')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {articlesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => <ArticleSkeleton key={i} />)}
              </div>
            ) : articles.length === 1 ? (
              <Link
                href={`/blog/${articles[0].slug}`}
                className="group block bg-white rounded-2xl overflow-hidden shadow-sm border border-neutral-200 hover:shadow-lg transition-shadow"
              >
                <div className="h-64 bg-neutral-100 flex items-center justify-center overflow-hidden">
                  {articles[0].imageUrl ? (
                    <Image src={articles[0].imageUrl} alt={articles[0].title} width={800} height={256} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <span className="text-6xl">🔬</span>
                  )}
                </div>
                <div className="p-8">
                  <h3 className="font-heading text-2xl text-neutral-900 mb-3 group-hover:text-primary-600 transition-colors">{articles[0].title}</h3>
                  {articles[0].excerpt && <p className="text-neutral-500 line-clamp-3 mb-4">{articles[0].excerpt}</p>}
                  <span className="text-primary-600 font-medium">{t('home.readMore')} →</span>
                </div>
              </Link>
            ) : (
              <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-all duration-700 delay-200 ${articlesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <Link
                  href={`/blog/${articles[0].slug}`}
                  className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-neutral-200 hover:shadow-lg transition-shadow"
                >
                  <div className="h-64 bg-neutral-100 flex items-center justify-center overflow-hidden">
                    {articles[0].imageUrl ? (
                      <Image src={articles[0].imageUrl} alt={articles[0].title} width={600} height={256} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <span className="text-6xl">🔬</span>
                    )}
                  </div>
                  <div className="p-6">
                    <h3 className="font-heading text-xl text-neutral-900 mb-2 group-hover:text-primary-600 transition-colors">{articles[0].title}</h3>
                    {articles[0].excerpt && <p className="text-sm text-neutral-500 line-clamp-3 mb-3">{articles[0].excerpt}</p>}
                    <span className="text-sm text-primary-600 font-medium">{t('home.readMore')} →</span>
                  </div>
                </Link>

                <div className="flex flex-col gap-4">
                  {articles.slice(1, 4).map((article) => (
                    <Link
                      key={article.id}
                      href={`/blog/${article.slug}`}
                      className="group flex gap-4 bg-white rounded-xl overflow-hidden shadow-sm border border-neutral-200 hover:shadow-md transition-shadow"
                    >
                      <div className="w-28 h-28 shrink-0 bg-neutral-100 flex items-center justify-center overflow-hidden">
                        {article.imageUrl ? (
                          <Image src={article.imageUrl} alt={article.title} width={112} height={112} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <span className="text-3xl">🔬</span>
                        )}
                      </div>
                      <div className="py-3 pr-4 flex flex-col justify-center">
                        <h3 className="font-semibold text-neutral-900 line-clamp-2 group-hover:text-primary-600 transition-colors text-sm">{article.title}</h3>
                        {article.excerpt && <p className="text-xs text-neutral-500 line-clamp-2 mt-1">{article.excerpt}</p>}
                        <span className="text-xs text-primary-600 font-medium mt-2">{t('home.readMore')} →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <SectionDivider fromColor="#FAFAF9" toColor="#FFFFFF" variant="curve" />

      {/* 8. Accessories Carousel */}
      {(loading || accessoryProducts.length > 0) && (
        <section ref={accessoriesRef} className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className={`flex justify-between items-center mb-8 transition-all duration-700 ${accessoriesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <div>
                <h2 className="font-heading text-3xl text-neutral-900">{t('home.accessoriesSection')}</h2>
                <p className="text-neutral-500 mt-1">{t('home.accessoriesDesc')}</p>
              </div>
              <Link
                href="/category/lab-accessories"
                className="text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1"
              >
                {t('shop.viewAll')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className={`transition-all duration-700 delay-200 ${accessoriesVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)}
                </div>
              ) : (
                <ProductCarousel products={accessoryProducts} />
              )}
            </div>
          </div>
        </section>
      )}

      <SectionDivider fromColor="#FFFFFF" toColor="#FAFAF9" variant="wave" />

      {/* 9. Lab Equipment (compact list) */}
      {(loading || labEquipmentProducts.length > 0) && (
        <section ref={labRef} className="py-16 bg-neutral-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className={`flex justify-between items-center mb-8 transition-all duration-700 ${labVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <div>
                <h2 className="font-heading text-3xl text-neutral-900">{t('home.labEquipmentSection')}</h2>
                <p className="text-neutral-500 mt-1">{t('home.labEquipmentDesc')}</p>
              </div>
              <Link
                href="/category/lab-equipment"
                className="text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1"
              >
                {t('shop.viewAll')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className={`transition-all duration-700 delay-200 ${labVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {Array.from({ length: 4 }).map((_, i) => <ProductSkeleton key={i} />)}
                </div>
              ) : (
                <ProductListCompact products={labEquipmentProducts} />
              )}
            </div>
          </div>
        </section>
      )}

      <SectionDivider fromColor="#FAFAF9" toColor="#FFFFFF" variant="curve" />

      {/* 10. Videos (section unique, fusionnee) */}
      <section ref={videoRef} className={`transition-all duration-700 ${videoVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
        <VideoPlacementWidget
          placement="HOMEPAGE_FEATURED"
          title={t('home.featuredVideos')}
          limit={3}
          className="py-16"
        />
      </section>

      {/* 11. Calculator */}
      <section className="py-16 bg-neutral-50">
        <div id="calculator" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-heading text-3xl text-center text-neutral-900 mb-8">{t('home.calculatorTitle')}</h2>
          <PeptideCalculator />
        </div>
      </section>

      {/* 12. Trust Badges */}
      <section className="py-12 bg-neutral-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <TrustBadges variant="horizontal" showAll={true} />
        </div>
      </section>

      <SectionDivider fromColor="#F5F5F4" toColor="#0F2440" variant="wave" />

      {/* 13. CTA (navy + signature inversee) */}
      <section ref={ctaRef} className="relative py-20 bg-navy-800 text-white overflow-hidden">
        <MoleculeBackground opacity={0.08} count={10} />
        <div className={`relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center transition-all duration-700 ${ctaVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div className="mb-8">
            <Image
              src="/images/brand/signature-header.png"
              alt="BioCycle Peptides"
              width={600}
              height={200}
              className="h-14 md:h-20 w-auto mx-auto brightness-0 invert"
            />
          </div>
          <h2 className="font-heading text-3xl md:text-4xl mb-4 text-white">
            {t('home.ctaTitleNew') || t('home.ctaTitle')}
          </h2>
          <p className="text-white/80 mb-8 text-lg">
            {t('home.ctaTextNew') || t('home.ctaText')}
          </p>
          <Link
            href="/shop"
            className="inline-block px-8 py-3 bg-primary-500 text-white font-semibold rounded-lg hover:bg-primary-600 transition-colors shadow-lg hover:shadow-xl"
          >
            {t('shop.shopNow')}
          </Link>
        </div>
      </section>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useI18n } from '@/i18n/client';
import { useCurrency } from '@/contexts/CurrencyContext';

interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  parentId?: string | null;
  children?: Category[];
  _count?: {
    products: number;
  };
}

interface FeaturedProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number | null;
  imageUrl?: string | null;
  purity?: number | null;
  isFeatured: boolean;
  images?: Array<{
    url: string;
    isPrimary: boolean;
  }>;
  formats?: Array<{
    price: number;
  }>;
}

interface MegaMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

// Icons for parent categories
const categoryIcons: Record<string, string> = {
  'laboratory-equipment': '🔬',
  'peptides': '🧬',
};

// Icons for peptide subcategories
const subCategoryIcons: Record<string, string> = {
  'anti-aging-longevity': '⏳',
  'weight-loss': '⚖️',
  'skin-health': '✨',
  'sexual-health': '💗',
  'cognitive-health': '🧠',
  'growth-metabolism': '📈',
  'muscle-growth': '💪',
  'recovery-repair': '🔧',
  'lab-equipment': '🧪',
  'lab-accessories': '💉',
};

export default function MegaMenu({ isOpen, onClose }: MegaMenuProps) {
  const { t, locale } = useI18n();
  const { formatPrice } = useCurrency();
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch categories (tree) and featured products
  useEffect(() => {
    if (isOpen) {
      Promise.all([
        fetch(`/api/categories?tree=true&locale=${locale}`).then(res => res.ok ? res.json() : { categories: [] }),
        fetch(`/api/products?featured=true&limit=3&locale=${locale}`).then(res => res.ok ? res.json() : { products: [] }),
      ])
        .then(([catData, prodData]) => {
          setCategories(catData.categories || []);
          setFeaturedProducts(prodData.products || []);
        })
        .catch(err => console.error('Error loading mega menu:', err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, locale]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Handle mouse leave with delay
  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  // Filter parent categories (those without parentId)
  const parentCategories = categories.filter(c => !c.parentId);

  return (
    <div
      ref={menuRef}
      className="absolute inset-x-0 top-full mt-0 bg-white text-black shadow-2xl border-t border-gray-200 z-40 animate-fadeIn"
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      role="menu"
      aria-label={t('shop.aria.megaMenu')}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Hierarchical Categories */}
            <div className="lg:col-span-5">
              <nav>
                {/* All Products link */}
                <Link
                  href="/shop"
                  onClick={onClose}
                  className="group flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-orange-50 transition-colors mb-2"
                >
                  <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 text-white group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <div className="font-semibold text-gray-900 group-hover:text-orange-600">
                    {t('nav.allProducts') || 'All Products'}
                  </div>
                </Link>

                {/* Parent categories with subcategories */}
                {parentCategories.map((parent) => (
                  <div key={parent.id} className="mb-4">
                    {/* Parent category header */}
                    <Link
                      href={`/category/${parent.slug}`}
                      onClick={onClose}
                      className="group flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-orange-50 transition-colors"
                    >
                      <span className="text-lg">{categoryIcons[parent.slug] || '📂'}</span>
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 group-hover:text-orange-600 text-sm uppercase tracking-wide">
                          {parent.name}
                        </div>
                        {parent._count && parent._count.products > 0 && (
                          <div className="text-xs text-gray-400">
                            {parent._count.products} {parent._count.products === 1 ? 'product' : 'products'}
                          </div>
                        )}
                      </div>
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transform group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>

                    {/* Subcategories */}
                    {parent.children && parent.children.length > 0 && (
                      <div className="ms-6 mt-1 space-y-0.5">
                        {parent.children.map((child) => (
                          <Link
                            key={child.id}
                            href={`/category/${child.slug}`}
                            onClick={onClose}
                            className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-orange-50 transition-colors"
                          >
                            <span className="text-sm">{subCategoryIcons[child.slug] || '•'}</span>
                            <span className="text-sm text-gray-700 group-hover:text-orange-600 transition-colors flex-1">
                              {child.name}
                            </span>
                            {child._count && child._count.products > 0 && (
                              <span className="text-xs text-gray-400">{child._count.products}</span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </nav>
            </div>

            {/* Center Column: Featured Products */}
            {featuredProducts.length > 0 && (
              <div className="lg:col-span-4">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">
                  {t('shop.featured') || 'Featured Products'}
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {featuredProducts.map((product) => {
                    const primaryImage = product.images?.find(img => img.isPrimary);
                    const lowestFormat = product.formats?.[0];
                    const displayPrice = lowestFormat ? lowestFormat.price : product.price;

                    return (
                      <Link
                        key={product.id}
                        href={`/product/${product.slug}`}
                        onClick={onClose}
                        className="group flex gap-4 p-4 rounded-lg border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all bg-white"
                      >
                        <div className="relative w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                          <Image
                            src={primaryImage?.url || product.imageUrl || '/images/products/peptide-default.png'}
                            alt={product.name}
                            fill
                            sizes="96px"
                            className="object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                          {product.purity && (
                            <div className="absolute top-1 end-1 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                              {product.purity}%
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors line-clamp-2 mb-1">
                            {product.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-lg font-bold text-orange-600">
                              {formatPrice(displayPrice)}
                            </span>
                            {product.compareAtPrice && product.compareAtPrice > displayPrice && (
                              <span className="text-sm text-gray-400 line-through">
                                {formatPrice(product.compareAtPrice)}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Right Column: Promo Banner / Quick Links */}
            <div className="lg:col-span-3">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">
                {t('nav.quickLinks') || 'Quick Links'}
              </h3>

              {/* Promo Banner */}
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white mb-4 hover:shadow-lg transition-shadow">
                <div className="text-sm font-semibold uppercase tracking-wide mb-2">
                  {t('shop.newArrival') || 'New Arrival'}
                </div>
                <h4 className="text-xl font-bold mb-3">
                  {t('shop.premiumPeptides') || 'Premium Peptides'}
                </h4>
                <p className="text-sm text-orange-100 mb-4">
                  {t('shop.highestPurity') || 'Highest purity, lab-tested quality'}
                </p>
                <Link
                  href="/shop?sort=newest"
                  onClick={onClose}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold text-sm hover:bg-orange-50 transition-colors"
                >
                  {t('shop.shopNow') || 'Shop Now'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>

              {/* Quick Links */}
              <div className="space-y-2">
                <Link
                  href="/lab-results"
                  onClick={onClose}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                >
                  <span>🔬</span>
                  {t('nav.labResults') || 'Lab Results'}
                </Link>
                <Link
                  href="/calculator"
                  onClick={onClose}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                >
                  <span>🧮</span>
                  {t('nav.calculator') || 'Calculator'}
                </Link>
                <Link
                  href="/learn"
                  onClick={onClose}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                >
                  <span>📚</span>
                  {t('nav.articles') || 'Articles'}
                </Link>
                <Link
                  href="/rewards"
                  onClick={onClose}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                >
                  <span>🎁</span>
                  {t('nav.rewards') || 'Rewards'}
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

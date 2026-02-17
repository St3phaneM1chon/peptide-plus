'use client';

import { useState, useMemo, useEffect } from 'react';
import { ProductCard } from '@/components/shop';
import RecentlyViewed from '@/components/shop/RecentlyViewed';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { useTranslations } from '@/hooks/useTranslations';
import { useCurrency } from '@/contexts/CurrencyContext';

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
    id: string;
    url: string;
    alt?: string;
    isPrimary?: boolean;
    sortOrder: number;
  }>;
  formats: Array<{
    id: string;
    name: string;
    formatType?: string;
    price: number | string;
    comparePrice?: number | string;
    isActive: boolean;
    stockQuantity: number;
    imageUrl?: string;
  }>;
  createdAt: string;
}

interface CategoryCount {
  name: string;
  slug: string;
  count: number;
}

type SortOption = 'popular' | 'newest' | 'price-asc' | 'price-desc' | 'name-asc';

export default function ShopPage() {
  const { t } = useTranslations();
  const { formatPrice } = useCurrency();

  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);
  const [showInStockOnly, setShowInStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const { locale } = useTranslations();

  // Fetch products from API with locale for translations
  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch(`/api/products?locale=${locale}`);
        if (!res.ok) throw new Error('Failed to fetch products');
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.products || data.data || [];
        setProducts(list.filter((p: ApiProduct) => p.isActive));
      } catch (err) {
        console.error('Error fetching products:', err);
        setError('Unable to load products');
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, [locale]);

  // Build dynamic categories from loaded products
  const categories = useMemo<CategoryCount[]>(() => {
    const catMap = new Map<string, { name: string; count: number }>();
    for (const p of products) {
      if (p.category) {
        const existing = catMap.get(p.category.slug);
        if (existing) {
          existing.count++;
        } else {
          catMap.set(p.category.slug, { name: p.category.name, count: 1 });
        }
      }
    }
    const cats: CategoryCount[] = [
      { name: t('shop.allProducts'), slug: 'all', count: products.length },
    ];
    for (const [slug, { name, count }] of catMap) {
      cats.push({ name, slug, count });
    }
    return cats;
  }, [products, t]);

  // Compute max price for the range slider
  const maxPrice = useMemo(() => {
    if (products.length === 0) return 500;
    let max = 0;
    for (const p of products) {
      for (const f of p.formats) {
        const price = Number(f.price);
        if (price > max) max = price;
      }
    }
    return Math.ceil(max / 50) * 50 || 500;
  }, [products]);

  // Map API products to ProductCard props, then filter & sort
  const filteredProducts = useMemo(() => {
    let result = products.map((p) => {
      const activeFormats = p.formats.filter((f) => f.isActive);
      const lowestPrice = activeFormats.length > 0
        ? Math.min(...activeFormats.map((f) => Number(f.price)))
        : 0;
      const hasStock = activeFormats.some((f) => f.stockQuantity > 0);

      // Use primary image from images array, or fallback to product imageUrl
      const primaryImage = p.images?.find((img) => img.isPrimary) || p.images?.[0];
      const productImageUrl = primaryImage?.url || p.imageUrl || undefined;

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: lowestPrice,
        purity: p.purity ? Number(p.purity) : undefined,
        imageUrl: productImageUrl,
        category: p.category?.name || '',
        categorySlug: p.category?.slug || '',
        inStock: hasStock,
        isNew: new Date(p.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        isBestseller: p.isFeatured,
        formats: activeFormats.map((f) => ({
          id: f.id,
          name: f.name,
          price: Number(f.price),
          comparePrice: f.comparePrice ? Number(f.comparePrice) : undefined,
          inStock: f.stockQuantity > 0,
          stockQuantity: f.stockQuantity,
          image: f.imageUrl || undefined,
        })),
      };
    });

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter((p) => p.categorySlug === selectedCategory);
    }

    // Price filter
    result = result.filter(
      (p) => p.price >= priceRange[0] && p.price <= priceRange[1]
    );

    // In stock filter
    if (showInStockOnly) {
      result = result.filter((p) => p.inStock);
    }

    // Sorting
    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'newest':
        result.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
        break;
      case 'popular':
      default:
        result.sort((a, b) => (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0));
        break;
    }

    return result;
  }, [products, selectedCategory, sortBy, priceRange, showInStockOnly]);

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: t('nav.home') || 'Home', href: '/' },
          { label: t('shop.shop') || 'Shop' },
        ]}
      />

      {/* Header */}
      <div className="bg-black text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl font-bold">{t('shop.allProducts')}</h1>
          <p className="text-neutral-400 mt-2">
            {t('home.peptidesDesc')}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mobile Filter Toggle */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-100 rounded-lg font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {t('shop.filters')}
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <aside className={`w-full lg:w-64 flex-shrink-0 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <div className="sticky top-20 space-y-6">
              {/* Categories */}
              <div>
                <h2 className="font-bold text-lg mb-4">{t('shop.filters')}</h2>
                <ul className="space-y-2">
                  {categories.map((cat) => (
                    <li key={cat.slug}>
                      <button
                        onClick={() => setSelectedCategory(cat.slug)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left ${
                          selectedCategory === cat.slug
                            ? 'bg-orange-50 text-orange-600 font-medium'
                            : 'text-neutral-600 hover:bg-neutral-50'
                        }`}
                      >
                        <span>{cat.name}</span>
                        <span className="text-sm text-neutral-400">{cat.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Price Range */}
              <div>
                <h3 className="font-semibold mb-3">{t('shop.price')}</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={priceRange[0]}
                      onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                      className="w-20 px-2 py-1 border rounded text-sm"
                      min={0}
                    />
                    <span>-</span>
                    <input
                      type="number"
                      value={priceRange[1]}
                      onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                      className="w-20 px-2 py-1 border rounded text-sm"
                      min={0}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxPrice}
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                    className="w-full accent-orange-500"
                  />
                  <p className="text-sm text-neutral-500">
                    {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])}
                  </p>
                </div>
              </div>

              {/* Stock Filter */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showInStockOnly}
                    onChange={(e) => setShowInStockOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm">{t('shop.inStock')}</span>
                </label>
              </div>

              {/* Reset Filters */}
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setPriceRange([0, maxPrice]);
                  setShowInStockOnly(false);
                  setSortBy('popular');
                }}
                className="text-sm text-orange-600 hover:underline"
              >
                Reset filters
              </button>
            </div>
          </aside>

          {/* Products */}
          <div className="flex-1">
            {/* Sort & Count */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <p className="text-neutral-500">
                {loading ? '...' : `${filteredProducts.length} ${filteredProducts.length === 1 ? 'product' : 'products'}`}
              </p>

              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-600">{t('shop.sortBy')}:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="popular">{t('shop.popular')}</option>
                  <option value="newest">{t('shop.newest')}</option>
                  <option value="price-asc">{t('shop.priceAsc')}</option>
                  <option value="price-desc">{t('shop.priceDesc')}</option>
                  <option value="name-asc">A-Z</option>
                </select>
              </div>
            </div>

            {/* Active Filters */}
            {(selectedCategory !== 'all' || showInStockOnly || priceRange[0] > 0 || priceRange[1] < maxPrice) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedCategory !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                    {categories.find(c => c.slug === selectedCategory)?.name}
                    <button onClick={() => setSelectedCategory('all')} className="hover:text-orange-900">×</button>
                  </span>
                )}
                {showInStockOnly && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                    {t('shop.inStock')}
                    <button onClick={() => setShowInStockOnly(false)} className="hover:text-green-900">×</button>
                  </span>
                )}
                {(priceRange[0] > 0 || priceRange[1] < maxPrice) && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                    {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])}
                    <button onClick={() => setPriceRange([0, maxPrice])} className="hover:text-blue-900">×</button>
                  </span>
                )}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-neutral-200 rounded-lg aspect-square mb-3" />
                    <div className="bg-neutral-200 h-4 rounded w-3/4 mb-2" />
                    <div className="bg-neutral-200 h-4 rounded w-1/2" />
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="text-center py-16">
                <p className="text-red-500 text-lg mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="text-orange-600 hover:underline"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Product Grid */}
            {!loading && !error && filteredProducts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} {...product} />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && filteredProducts.length === 0 && (
              <div className="text-center py-16">
                <p className="text-neutral-500 text-lg mb-4">No products found</p>
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setPriceRange([0, maxPrice]);
                    setShowInStockOnly(false);
                  }}
                  className="text-orange-600 hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Recently Viewed Products */}
        <RecentlyViewed />
      </div>
    </div>
  );
}

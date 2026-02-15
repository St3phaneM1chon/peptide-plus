'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { ProductCard } from '@/components/shop';
import { useTranslations } from '@/hooks/useTranslations';
import { useCurrency } from '@/contexts/CurrencyContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface CategoryFacet {
  id: string;
  name: string;
  slug: string;
  count: number;
}

type SortOption = 'relevance' | 'price-asc' | 'price-desc' | 'newest';

// ---------------------------------------------------------------------------
// Inner component that reads searchParams
// ---------------------------------------------------------------------------

function SearchPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useTranslations();
  const { formatPrice } = useCurrency();

  // Read query from URL
  const query = searchParams.get('q') || '';

  // Local state
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [categories, setCategories] = useState<CategoryFacet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);
  const [showInStockOnly, setShowInStockOnly] = useState(false);
  const [purityFilter, setPurityFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [showFilters, setShowFilters] = useState(false);

  // Fetch search results
  useEffect(() => {
    async function fetchResults() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        params.set('limit', '100');

        const res = await fetch(`/api/products/search?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();

        const list: ApiProduct[] = data.products || [];
        setProducts(list);
        setCategories(data.categories || []);
      } catch (err) {
        console.error('Search fetch error:', err);
        setError('Unable to load search results');
      } finally {
        setLoading(false);
      }
    }
    fetchResults();
  }, [query]);

  // Compute max price from results
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

  // Reset price range upper bound when maxPrice changes
  useEffect(() => {
    setPriceRange((prev) => [prev[0], maxPrice]);
  }, [maxPrice]);

  // Map, filter, and sort products
  const filteredProducts = useMemo(() => {
    let result = products.map((p) => {
      const activeFormats = p.formats.filter((f) => f.isActive);
      const lowestPrice =
        activeFormats.length > 0
          ? Math.min(...activeFormats.map((f) => Number(f.price)))
          : 0;
      const hasStock = activeFormats.some((f) => f.stockQuantity > 0);
      const primaryImage =
        p.images?.find((img) => img.isPrimary) || p.images?.[0];
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
        isNew:
          new Date(p.createdAt) >
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
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

    // Category filter (multi-select)
    if (selectedCategories.length > 0) {
      result = result.filter((p) =>
        selectedCategories.includes(p.categorySlug)
      );
    }

    // Price filter
    result = result.filter(
      (p) => p.price >= priceRange[0] && p.price <= priceRange[1]
    );

    // In stock filter
    if (showInStockOnly) {
      result = result.filter((p) => p.inStock);
    }

    // Purity filter
    if (purityFilter !== null) {
      result = result.filter((p) => p.purity && p.purity >= purityFilter);
    }

    // Sorting
    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'newest':
        result.sort(
          (a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)
        );
        break;
      case 'relevance':
      default:
        result.sort(
          (a, b) => (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0)
        );
        break;
    }

    return result;
  }, [
    products,
    selectedCategories,
    priceRange,
    showInStockOnly,
    purityFilter,
    sortBy,
  ]);

  // Toggle category selection
  const toggleCategory = useCallback((slug: string) => {
    setSelectedCategories((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }, []);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setSelectedCategories([]);
    setPriceRange([0, maxPrice]);
    setShowInStockOnly(false);
    setPurityFilter(null);
    setSortBy('relevance');
  }, [maxPrice]);

  // Check if any filter is active
  const hasActiveFilters =
    selectedCategories.length > 0 ||
    showInStockOnly ||
    purityFilter !== null ||
    priceRange[0] > 0 ||
    priceRange[1] < maxPrice;

  // Popular search suggestions for empty state
  const popularSearches = [
    'BPC-157',
    'TB-500',
    'Semaglutide',
    'Tirzepatide',
    'Ipamorelin',
    'GHK-Cu',
  ];

  // Purity filter options
  const purityOptions = [
    { label: '> 95%', value: 95 },
    { label: '> 98%', value: 98 },
    { label: '> 99%', value: 99 },
  ];

  // Build breadcrumb items
  const breadcrumbItems = [
    { label: t('nav.home') || 'Home', href: '/' },
    { label: t('shop.search')?.replace('...', '') || 'Search Results' },
  ];
  if (query) {
    breadcrumbItems.push({ label: `"${query}"` });
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumbs */}
      <Breadcrumbs items={breadcrumbItems} />

      {/* Header */}
      <div className="bg-black text-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl md:text-3xl font-bold">
            {query ? (
              <>
                Search results for &ldquo;{query}&rdquo;
              </>
            ) : (
              'Search Products'
            )}
          </h1>
          {/* Inline search bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const newQ = (formData.get('q') as string)?.trim();
              if (newQ) {
                router.push(`/search?q=${encodeURIComponent(newQ)}`);
              }
            }}
            className="mt-4 flex max-w-xl"
          >
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                name="q"
                defaultValue={query}
                placeholder={t('shop.search')}
                aria-label="Search products"
                className="w-full pl-10 pr-4 py-3 rounded-l-lg text-neutral-900 placeholder:text-neutral-400 outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-r-lg hover:bg-orange-600 transition-colors"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mobile Filter Toggle */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-100 rounded-lg font-medium"
            aria-expanded={showFilters}
            aria-controls="search-filters"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            {t('shop.filters')}
            {hasActiveFilters && (
              <span className="ml-1 w-5 h-5 flex items-center justify-center bg-orange-500 text-white text-xs rounded-full">
                {selectedCategories.length +
                  (showInStockOnly ? 1 : 0) +
                  (purityFilter !== null ? 1 : 0) +
                  (priceRange[0] > 0 || priceRange[1] < maxPrice ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* ---------------------------------------------------------------- */}
          {/* Sidebar Filters */}
          {/* ---------------------------------------------------------------- */}
          <aside
            id="search-filters"
            className={`w-full lg:w-64 flex-shrink-0 ${showFilters ? 'block' : 'hidden lg:block'}`}
          >
            <div className="sticky top-20 space-y-6">
              <h2 className="font-bold text-lg">{t('shop.filters')}</h2>

              {/* Category checkboxes */}
              <div>
                <h3 className="font-semibold mb-3">Category</h3>
                <ul className="space-y-2">
                  {categories
                    .filter((c) => c.count > 0)
                    .map((cat) => (
                      <li key={cat.slug}>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(cat.slug)}
                            onChange={() => toggleCategory(cat.slug)}
                            className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 border-neutral-300"
                          />
                          <span className="text-sm text-neutral-700 group-hover:text-orange-600 transition-colors flex-1">
                            {cat.name}
                          </span>
                          <span className="text-xs text-neutral-400">
                            {cat.count}
                          </span>
                        </label>
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
                      onChange={(e) =>
                        setPriceRange([Number(e.target.value), priceRange[1]])
                      }
                      className="w-20 px-2 py-1 border rounded text-sm"
                      min={0}
                      aria-label="Minimum price"
                    />
                    <span className="text-neutral-400">-</span>
                    <input
                      type="number"
                      value={priceRange[1]}
                      onChange={(e) =>
                        setPriceRange([priceRange[0], Number(e.target.value)])
                      }
                      className="w-20 px-2 py-1 border rounded text-sm"
                      min={0}
                      aria-label="Maximum price"
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxPrice}
                    value={priceRange[1]}
                    onChange={(e) =>
                      setPriceRange([priceRange[0], Number(e.target.value)])
                    }
                    className="w-full accent-orange-500"
                    aria-label="Price range slider"
                  />
                  <p className="text-sm text-neutral-500">
                    {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])}
                  </p>
                </div>
              </div>

              {/* In Stock Toggle */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showInStockOnly}
                    onChange={(e) => setShowInStockOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-500 focus:ring-orange-500 border-neutral-300"
                  />
                  <span className="text-sm font-medium">
                    {t('shop.inStock')} only
                  </span>
                </label>
              </div>

              {/* Purity Filter */}
              <div>
                <h3 className="font-semibold mb-3">{t('shop.purity')}</h3>
                <div className="space-y-2">
                  {purityOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="purity"
                        checked={purityFilter === opt.value}
                        onChange={() =>
                          setPurityFilter(
                            purityFilter === opt.value ? null : opt.value
                          )
                        }
                        className="w-4 h-4 text-orange-500 focus:ring-orange-500 border-neutral-300"
                      />
                      <span className="text-sm text-neutral-700">
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Reset Filters */}
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-sm text-orange-600 hover:underline"
                >
                  Reset filters
                </button>
              )}
            </div>
          </aside>

          {/* ---------------------------------------------------------------- */}
          {/* Results Area */}
          {/* ---------------------------------------------------------------- */}
          <div className="flex-1">
            {/* Sort & Count */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <p className="text-neutral-500" aria-live="polite">
                {loading
                  ? '...'
                  : `${filteredProducts.length} ${
                      filteredProducts.length === 1 ? 'product' : 'products'
                    }${query ? ` for "${query}"` : ''}`}
              </p>

              <div className="flex items-center gap-2">
                <label htmlFor="sort-select" className="text-sm text-neutral-600">
                  {t('shop.sortBy')}:
                </label>
                <select
                  id="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="relevance">Relevance</option>
                  <option value="newest">{t('shop.newest')}</option>
                  <option value="price-asc">{t('shop.priceAsc')}</option>
                  <option value="price-desc">{t('shop.priceDesc')}</option>
                </select>
              </div>
            </div>

            {/* Active Filter Chips */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedCategories.map((slug) => {
                  const cat = categories.find((c) => c.slug === slug);
                  return (
                    <span
                      key={slug}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm"
                    >
                      {cat?.name || slug}
                      <button
                        onClick={() => toggleCategory(slug)}
                        className="hover:text-orange-900"
                        aria-label={`Remove ${cat?.name || slug} filter`}
                      >
                        x
                      </button>
                    </span>
                  );
                })}
                {showInStockOnly && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                    {t('shop.inStock')}
                    <button
                      onClick={() => setShowInStockOnly(false)}
                      className="hover:text-green-900"
                      aria-label="Remove in-stock filter"
                    >
                      x
                    </button>
                  </span>
                )}
                {purityFilter !== null && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm">
                    {t('shop.purity')} &gt; {purityFilter}%
                    <button
                      onClick={() => setPurityFilter(null)}
                      className="hover:text-emerald-900"
                      aria-label="Remove purity filter"
                    >
                      x
                    </button>
                  </span>
                )}
                {(priceRange[0] > 0 || priceRange[1] < maxPrice) && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                    {formatPrice(priceRange[0])} -{' '}
                    {formatPrice(priceRange[1])}
                    <button
                      onClick={() => setPriceRange([0, maxPrice])}
                      className="hover:text-blue-900"
                      aria-label="Remove price filter"
                    >
                      x
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* Loading Skeleton */}
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

            {/* Error State */}
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
                <svg
                  className="mx-auto w-16 h-16 text-neutral-300 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {query ? (
                  <>
                    <p className="text-neutral-700 text-lg font-medium mb-2">
                      No results for &ldquo;{query}&rdquo;
                    </p>
                    <p className="text-neutral-500 mb-6">
                      Try adjusting your search or filters to find what you are
                      looking for.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-neutral-700 text-lg font-medium mb-2">
                      Start searching
                    </p>
                    <p className="text-neutral-500 mb-6">
                      Enter a keyword above to find research peptides.
                    </p>
                  </>
                )}

                {/* Suggestions */}
                <div className="mb-6">
                  <p className="text-sm text-neutral-500 mb-3">
                    Popular searches
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {popularSearches.map((term) => (
                      <Link
                        key={term}
                        href={`/search?q=${encodeURIComponent(term)}`}
                        className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-full text-sm hover:bg-neutral-200 transition-colors"
                      >
                        {term}
                      </Link>
                    ))}
                  </div>
                </div>

                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="text-orange-600 hover:underline font-medium"
                  >
                    Clear all filters
                  </button>
                )}

                <div className="mt-6">
                  <Link
                    href="/shop"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-colors"
                  >
                    {t('shop.shopAll')}
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component with Suspense boundary for useSearchParams
// ---------------------------------------------------------------------------

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}

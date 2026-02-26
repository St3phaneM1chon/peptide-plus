'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { ProductCard } from '@/components/shop';
import RecentlyViewed from '@/components/shop/RecentlyViewed';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { useI18n } from '@/i18n/client';
import { useCurrency } from '@/contexts/CurrencyContext';
import { NEW_PRODUCT_DAYS } from '@/lib/constants';

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
    parentId?: string | null;
    parent?: { id: string; name: string; slug: string } | null;
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
  parentId?: string | null;
  parentSlug?: string;
  children?: CategoryCount[];
}

type SortOption = 'popular' | 'newest' | 'price-asc' | 'price-desc' | 'name-asc';

export default function ShopPage() {
  const { t, tp, locale } = useI18n();
  const { formatPrice } = useCurrency();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalProducts, setTotalProducts] = useState(0);
  const [currentPage, setCurrentPage] = useState(
    Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  );
  const PRODUCTS_PER_PAGE = 24;

  // Filter states - initialize from URL params
  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get('category') || 'all'
  );
  const [sortBy, setSortBy] = useState<SortOption>(
    (searchParams.get('sort') as SortOption) || 'popular'
  );
  const [priceRange, setPriceRange] = useState<[number, number]>(() => {
    const minP = Number(searchParams.get('minPrice')) || 0;
    const maxP = Number(searchParams.get('maxPrice')) || 5000;
    return [minP, maxP];
  });
  const [showInStockOnly, setShowInStockOnly] = useState(
    searchParams.get('inStock') === 'true'
  );
  const [showFilters, setShowFilters] = useState(false);

  // Sync filter state changes to URL query params
  const updateUrlParams = useCallback((params: Record<string, string | null>) => {
    const current = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === '' || value === undefined) {
        current.delete(key);
      } else {
        current.set(key, value);
      }
    }
    // Remove default values to keep URL clean
    if (current.get('category') === 'all') current.delete('category');
    if (current.get('sort') === 'popular') current.delete('sort');
    if (current.get('minPrice') === '0') current.delete('minPrice');
    if (current.get('inStock') === 'false') current.delete('inStock');

    const search = current.toString();
    router.replace(`${pathname}${search ? `?${search}` : ''}`, { scroll: false });
  }, [searchParams, router, pathname]);

  // BUG-008 FIX: Server-side pagination instead of loading all products at once
  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        // Build server-side query with filters and pagination
        const params = new URLSearchParams();
        params.set('locale', locale);
        params.set('page', String(currentPage));
        params.set('limit', String(PRODUCTS_PER_PAGE));
        if (selectedCategory !== 'all') params.set('category', selectedCategory);
        if (showInStockOnly) params.set('inStock', 'true');
        if (priceRange[0] > 0) params.set('minPrice', String(priceRange[0]));
        if (priceRange[1] < 5000) params.set('maxPrice', String(priceRange[1]));
        params.set('facets', 'true');

        const res = await fetch(`/api/products?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch products');
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.products || data.data?.products || data.data || [];
        setProducts(list.filter((p: ApiProduct) => p.isActive));
        // Use pagination total from API if available
        if (data.pagination?.total != null) {
          setTotalProducts(data.pagination.total);
        } else if (data.total != null) {
          setTotalProducts(data.total);
        } else {
          setTotalProducts(list.length);
        }
      } catch (err) {
        console.error('Error fetching products:', err);
        setError(t('shop.loadError'));
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, [locale, currentPage, selectedCategory, showInStockOnly, priceRange]);

  // Build hierarchical categories from loaded products
  const categories = useMemo<CategoryCount[]>(() => {
    // Count products per category slug
    const catMap = new Map<string, { name: string; count: number; parentId?: string | null; parentSlug?: string; parentName?: string }>();
    for (const p of products) {
      if (p.category) {
        const existing = catMap.get(p.category.slug);
        if (existing) {
          existing.count++;
        } else {
          catMap.set(p.category.slug, {
            name: p.category.name,
            count: 1,
            parentId: p.category.parentId,
            parentSlug: p.category.parent?.slug,
            parentName: p.category.parent?.name,
          });
        }
      }
    }

    // Build parent→children structure
    const parentMap = new Map<string, CategoryCount>();
    const childrenByParent = new Map<string, CategoryCount[]>();

    for (const [slug, info] of catMap) {
      if (info.parentSlug) {
        // This is a child category
        const children = childrenByParent.get(info.parentSlug) || [];
        children.push({ name: info.name, slug, count: info.count, parentId: info.parentId, parentSlug: info.parentSlug });
        childrenByParent.set(info.parentSlug, children);

        // Ensure parent exists in parentMap
        if (!parentMap.has(info.parentSlug)) {
          parentMap.set(info.parentSlug, {
            name: info.parentName || info.parentSlug,
            slug: info.parentSlug,
            count: 0,
          });
        }
      } else {
        // This is a parent or standalone category
        const existing = parentMap.get(slug);
        if (existing) {
          existing.count += info.count;
          existing.name = info.name;
        } else {
          parentMap.set(slug, { name: info.name, slug, count: info.count });
        }
      }
    }

    // Build final list
    const cats: CategoryCount[] = [
      { name: t('shop.allProducts'), slug: 'all', count: products.length },
    ];

    for (const [slug, parent] of parentMap) {
      const children = childrenByParent.get(slug) || [];
      const childCount = children.reduce((s, c) => s + c.count, 0);
      cats.push({
        ...parent,
        count: parent.count + childCount,
        children,
      });
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
      const activeFormats = (p.formats || []).filter((f) => f.isActive);
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
        // BUG-019 FIX: Use constant instead of hardcoded 30 days
        isNew: new Date(p.createdAt) > new Date(Date.now() - NEW_PRODUCT_DAYS * 24 * 60 * 60 * 1000),
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

    // Category filter (parent selection includes all children)
    if (selectedCategory !== 'all') {
      const selectedCat = categories.find(c => c.slug === selectedCategory);
      if (selectedCat?.children && selectedCat.children.length > 0) {
        // Parent category: show products from this parent and all children
        const childSlugs = new Set(selectedCat.children.map(c => c.slug));
        childSlugs.add(selectedCategory);
        result = result.filter((p) => childSlugs.has(p.categorySlug));
      } else {
        result = result.filter((p) => p.categorySlug === selectedCategory);
      }
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
          { label: t('nav.home'), href: '/' },
          { label: t('shop.shop') },
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
              {/* Categories (hierarchical) */}
              <div>
                <h2 className="font-bold text-lg mb-4">{t('shop.filters')}</h2>
                <ul className="space-y-1">
                  {categories.map((cat) => (
                    <li key={cat.slug}>
                      <button
                        onClick={() => { setSelectedCategory(cat.slug); updateUrlParams({ category: cat.slug }); }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-start ${
                          selectedCategory === cat.slug
                            ? 'bg-orange-50 text-orange-600 font-medium'
                            : 'text-neutral-600 hover:bg-neutral-50'
                        }`}
                      >
                        <span className={cat.children && cat.children.length > 0 ? 'font-semibold' : ''}>{cat.name}</span>
                        <span className="text-sm text-neutral-400">{cat.count}</span>
                      </button>
                      {/* Show subcategories when parent is selected or always visible */}
                      {cat.children && cat.children.length > 0 && (
                        <ul className="ms-4 mt-1 space-y-0.5">
                          {cat.children.map((child) => (
                            <li key={child.slug}>
                              <button
                                onClick={() => { setSelectedCategory(child.slug); updateUrlParams({ category: child.slug }); }}
                                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors text-start text-sm ${
                                  selectedCategory === child.slug
                                    ? 'bg-orange-50 text-orange-600 font-medium'
                                    : 'text-neutral-500 hover:bg-neutral-50'
                                }`}
                              >
                                <span>{child.name}</span>
                                <span className="text-xs text-neutral-400">{child.count}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
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
                      onChange={(e) => { const v = Number(e.target.value); setPriceRange([v, priceRange[1]]); updateUrlParams({ minPrice: String(v) }); }}
                      className="w-20 px-2 py-1 border rounded text-sm"
                      min={0}
                    />
                    <span>-</span>
                    <input
                      type="number"
                      value={priceRange[1]}
                      onChange={(e) => { const v = Number(e.target.value); setPriceRange([priceRange[0], v]); updateUrlParams({ maxPrice: String(v) }); }}
                      className="w-20 px-2 py-1 border rounded text-sm"
                      min={0}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={maxPrice}
                    value={priceRange[1]}
                    onChange={(e) => { const v = Number(e.target.value); setPriceRange([priceRange[0], v]); updateUrlParams({ maxPrice: String(v) }); }}
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
                    onChange={(e) => { setShowInStockOnly(e.target.checked); updateUrlParams({ inStock: e.target.checked ? 'true' : null }); }}
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
                  router.replace(pathname, { scroll: false });
                }}
                className="text-sm text-orange-600 hover:underline"
              >
                {t('shop.resetFilters')}
              </button>
            </div>
          </aside>

          {/* Products */}
          <div className="flex-1">
            {/* Sort & Count */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <p className="text-neutral-500">
                {loading ? '...' : tp('shop.productCount', filteredProducts.length)}
              </p>

              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-600">{t('shop.sortBy')}:</label>
                <select
                  value={sortBy}
                  onChange={(e) => { const v = e.target.value as SortOption; setSortBy(v); updateUrlParams({ sort: v }); }}
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
                    <button onClick={() => { setSelectedCategory('all'); updateUrlParams({ category: null }); }} className="hover:text-orange-900">×</button>
                  </span>
                )}
                {showInStockOnly && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                    {t('shop.inStock')}
                    <button onClick={() => { setShowInStockOnly(false); updateUrlParams({ inStock: null }); }} className="hover:text-green-900">×</button>
                  </span>
                )}
                {(priceRange[0] > 0 || priceRange[1] < maxPrice) && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                    {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])}
                    <button onClick={() => { setPriceRange([0, maxPrice]); updateUrlParams({ minPrice: null, maxPrice: null }); }} className="hover:text-blue-900">×</button>
                  </span>
                )}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
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
                  {t('shop.retry')}
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
                <p className="text-neutral-500 text-lg mb-4">{t('shop.noProductsFound')}</p>
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setPriceRange([0, maxPrice]);
                    setShowInStockOnly(false);
                    setCurrentPage(1);
                    router.replace(pathname, { scroll: false });
                  }}
                  className="text-orange-600 hover:underline"
                >
                  {t('shop.clearAllFilters')}
                </button>
              </div>
            )}

            {/* BUG-008 FIX: Server-side pagination controls */}
            {!loading && !error && totalProducts > PRODUCTS_PER_PAGE && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <button
                  onClick={() => { const p = Math.max(1, currentPage - 1); setCurrentPage(p); updateUrlParams({ page: String(p) }); }}
                  disabled={currentPage <= 1}
                  className="px-4 py-2 border border-neutral-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50"
                >
                  {t('common.previous')}
                </button>
                <span className="text-sm text-neutral-600">
                  {currentPage} / {Math.ceil(totalProducts / PRODUCTS_PER_PAGE)}
                </span>
                <button
                  onClick={() => { const p = currentPage + 1; setCurrentPage(p); updateUrlParams({ page: String(p) }); }}
                  disabled={currentPage >= Math.ceil(totalProducts / PRODUCTS_PER_PAGE)}
                  className="px-4 py-2 border border-neutral-200 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-neutral-50"
                >
                  {t('common.next')}
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

/**
 * ProductCardSkeleton - Matches ProductCard dimensions for smooth loading
 */
function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden flex flex-col h-full animate-pulse">
      {/* Image placeholder */}
      <div className="relative aspect-square bg-neutral-200 rounded-t-xl" />
      {/* Content placeholder */}
      <div className="p-4 flex flex-col flex-grow">
        {/* Title */}
        <div className="h-5 bg-neutral-200 rounded w-3/4 mb-2" />
        {/* Price */}
        <div className="h-5 bg-neutral-200 rounded w-1/3 mb-2" />
        {/* Purity/Mass */}
        <div className="h-4 bg-neutral-200 rounded w-1/2 mb-4" />
        {/* Bottom section */}
        <div className="mt-auto pt-4">
          {/* Format selector placeholder */}
          <div className="h-4 bg-neutral-200 rounded w-1/4 mb-2" />
          <div className="h-10 bg-neutral-200 rounded mb-4" />
          {/* Quantity + Button */}
          <div className="flex items-center gap-2">
            <div className="h-8 w-24 bg-neutral-200 rounded" />
            <div className="flex-1 h-10 bg-neutral-200 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

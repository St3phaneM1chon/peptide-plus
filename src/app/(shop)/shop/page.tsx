'use client';

import { useState, useMemo } from 'react';
import { ProductCard } from '@/components/shop';
import { useTranslations } from '@/hooks/useTranslations';
import { useCurrency } from '@/contexts/CurrencyContext';

// All products
const allProducts = [
  {
    id: '1',
    name: 'Tesamorelin 20mg',
    slug: 'tesamorelin',
    price: 150,
    purity: 99.60,
    avgMass: '23.84 mg',
    category: 'Peptides',
    subcategory: 'weight-loss',
    inStock: true,
    isNew: false,
    isBestseller: true,
    formats: [
      { id: 'f1a', name: 'Single vial', price: 150, inStock: true, stockQuantity: 100 },
      { id: 'f1b', name: '10-pack', price: 1200, inStock: true, stockQuantity: 30 },
    ],
  },
  {
    id: '2',
    name: 'Semaglutide 10mg',
    slug: 'semaglutide',
    price: 80,
    purity: 99.64,
    avgMass: '10.85 mg',
    category: 'Peptides',
    subcategory: 'weight-loss',
    inStock: true,
    isNew: false,
    isBestseller: true,
    formats: [
      { id: 'f2a', name: 'Single vial', price: 80, inStock: true, stockQuantity: 80 },
      { id: 'f2b', name: '10-pack', price: 640, inStock: true, stockQuantity: 25 },
    ],
  },
  {
    id: '3',
    name: 'BPC-157 / TB-500 "Healing Blend" 6mg/6mg',
    slug: 'bpc-157-tb-500-blend',
    price: 70,
    avgMass: '7.13 mg',
    category: 'Peptides',
    subcategory: 'recovery',
    inStock: true,
    isNew: true,
    isBestseller: true,
    formats: [
      { id: 'f3a', name: 'Single vial', price: 70, inStock: true, stockQuantity: 100 },
      { id: 'f3b', name: '10-pack', price: 560, inStock: true, stockQuantity: 20 },
    ],
  },
  {
    id: '4',
    name: 'Retatrutide 10mg',
    slug: 'retatrutide',
    price: 90,
    purity: 99.30,
    avgMass: '10.46 mg',
    category: 'Peptides',
    subcategory: 'weight-loss',
    inStock: true,
    isNew: true,
    isBestseller: false,
    formats: [
      { id: 'f4a', name: 'Single vial', price: 90, inStock: true, stockQuantity: 60 },
      { id: 'f4b', name: '10-pack', price: 720, inStock: true, stockQuantity: 15 },
    ],
  },
  {
    id: '5',
    name: 'Tirzepatide 10mg',
    slug: 'tirzepatide',
    price: 60,
    purity: 99.74,
    avgMass: '10.12 mg',
    category: 'Peptides',
    subcategory: 'weight-loss',
    inStock: true,
    isNew: false,
    isBestseller: true,
    formats: [
      { id: 'f5a', name: 'Single vial', price: 60, inStock: true, stockQuantity: 70 },
      { id: 'f5b', name: '10-pack', price: 480, inStock: true, stockQuantity: 20 },
    ],
  },
  {
    id: '6',
    name: 'BPC-157 5mg',
    slug: 'bpc-157',
    price: 40,
    purity: 99.83,
    avgMass: '5.21 mg',
    category: 'Peptides',
    subcategory: 'recovery',
    inStock: true,
    isNew: false,
    isBestseller: true,
    formats: [
      { id: 'f6a', name: 'Single vial', price: 40, inStock: true, stockQuantity: 150 },
      { id: 'f6b', name: '10-pack', price: 320, inStock: true, stockQuantity: 40 },
    ],
  },
  {
    id: '7',
    name: 'TB-500 5mg',
    slug: 'tb-500',
    price: 40,
    purity: 99.43,
    avgMass: '5.08 mg',
    category: 'Peptides',
    subcategory: 'recovery',
    inStock: true,
    isNew: false,
    isBestseller: false,
    formats: [
      { id: 'f7a', name: 'Single vial', price: 40, inStock: true, stockQuantity: 120 },
      { id: 'f7b', name: '10-pack', price: 320, inStock: true, stockQuantity: 35 },
    ],
  },
  {
    id: '8',
    name: 'Ipamorelin 5mg',
    slug: 'ipamorelin',
    price: 27,
    purity: 99.50,
    avgMass: '5.15 mg',
    category: 'Peptides',
    subcategory: 'muscle-growth',
    inStock: true,
    isNew: false,
    isBestseller: false,
    formats: [
      { id: 'f8a', name: 'Single vial', price: 27, inStock: true, stockQuantity: 200 },
      { id: 'f8b', name: '10-pack', price: 216, inStock: true, stockQuantity: 50 },
    ],
  },
  {
    id: '9',
    name: 'IGF-1 LR3 1mg',
    slug: 'igf-1-lr3',
    price: 75,
    purity: 99.51,
    avgMass: '1.02 mg',
    category: 'Peptides',
    subcategory: 'muscle-growth',
    inStock: true,
    isNew: false,
    isBestseller: false,
    formats: [
      { id: 'f9a', name: 'Single vial', price: 75, inStock: true, stockQuantity: 50 },
      { id: 'f9b', name: '10-pack', price: 600, inStock: true, stockQuantity: 15 },
    ],
  },
  {
    id: '10',
    name: 'Epithalon 20mg',
    slug: 'epithalon',
    price: 28,
    purity: 99.20,
    avgMass: '20.15 mg',
    category: 'Peptides',
    subcategory: 'longevity',
    inStock: true,
    isNew: false,
    isBestseller: false,
    formats: [
      { id: 'f10a', name: 'Single vial', price: 28, inStock: true, stockQuantity: 80 },
      { id: 'f10b', name: '10-pack', price: 224, inStock: true, stockQuantity: 25 },
    ],
  },
  {
    id: '11',
    name: 'PT-141 10mg',
    slug: 'pt-141',
    price: 42,
    purity: 99.40,
    avgMass: '10.23 mg',
    category: 'Peptides',
    subcategory: 'wellness',
    inStock: true,
    isNew: false,
    isBestseller: false,
    formats: [
      { id: 'f11a', name: 'Single vial', price: 42, inStock: true, stockQuantity: 90 },
      { id: 'f11b', name: '10-pack', price: 336, inStock: true, stockQuantity: 20 },
    ],
  },
  {
    id: '12',
    name: 'Bacteriostatic Water 10ml',
    slug: 'bacteriostatic-water',
    price: 13,
    category: 'Accessories',
    subcategory: 'supplies',
    inStock: true,
    isNew: false,
    isBestseller: false,
    formats: [
      { id: 'f12a', name: 'Single', price: 13, inStock: true, stockQuantity: 500 },
      { id: 'f12b', name: '5-pack', price: 55, inStock: true, stockQuantity: 100 },
    ],
  },
];

const categories = [
  { name: 'All Products', slug: 'all', count: allProducts.length },
  { name: 'Peptides', slug: 'peptides', count: 11 },
  { name: 'Weight Loss', slug: 'weight-loss', count: 4 },
  { name: 'Recovery', slug: 'recovery', count: 3 },
  { name: 'Muscle Growth', slug: 'muscle-growth', count: 2 },
  { name: 'Accessories', slug: 'accessories', count: 1 },
];

type SortOption = 'popular' | 'newest' | 'price-asc' | 'price-desc' | 'name-asc';

export default function ShopPage() {
  const { t } = useTranslations();
  const { formatPrice } = useCurrency();
  
  // Filter states
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 200]);
  const [showInStockOnly, setShowInStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...allProducts];

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter(
        (p) => 
          p.category.toLowerCase() === selectedCategory.toLowerCase() ||
          p.subcategory === selectedCategory
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
  }, [selectedCategory, sortBy, priceRange, showInStockOnly]);

  return (
    <div className="min-h-screen bg-white">
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
                    max={200}
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
                  setPriceRange([0, 200]);
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
                {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
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
            {(selectedCategory !== 'all' || showInStockOnly || priceRange[0] > 0 || priceRange[1] < 200) && (
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
                {(priceRange[0] > 0 || priceRange[1] < 200) && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                    {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])}
                    <button onClick={() => setPriceRange([0, 200])} className="hover:text-blue-900">×</button>
                  </span>
                )}
              </div>
            )}

            {/* Product Grid */}
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} {...product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-neutral-500 text-lg mb-4">No products found</p>
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setPriceRange([0, 200]);
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
      </div>
    </div>
  );
}

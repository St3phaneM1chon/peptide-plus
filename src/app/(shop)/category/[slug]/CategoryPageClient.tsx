'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ProductCard } from '@/components/shop';
import { useI18n } from '@/i18n/client';

interface ProductFormat {
  id: string;
  name: string;
  price: number;
  comparePrice?: number;
  inStock: boolean;
  stockQuantity: number;
}

interface Product {
  id: string;
  name: string;
  subtitle?: string;
  slug: string;
  price: number;
  comparePrice?: number;
  purity?: number;
  avgMass?: string;
  imageUrl?: string;
  isNew?: boolean;
  isBestseller?: boolean;
  inStock: boolean;
  formats: ProductFormat[];
}

interface SubCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  productCount: number;
}

interface Category {
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  parentId?: string | null;
  parent?: { name: string; slug: string };
  children?: SubCategory[];
}

interface CategoryPageClientProps {
  category: Category;
  products: Product[];
}

type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'name';

// Subcategory icons
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

export default function CategoryPageClient({ category, products }: CategoryPageClientProps) {
  const { t, tp } = useI18n();
  const [sortBy, setSortBy] = useState<SortOption>('featured');

  const hasChildren = category.children && category.children.length > 0;
  const hasParent = !!category.parent;

  const sortedProducts = useMemo(() => {
    const result = [...products];

    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'featured':
      default:
        result.sort((a, b) => (b.isBestseller ? 1 : 0) - (a.isBestseller ? 1 : 0));
    }

    return result;
  }, [products, sortBy]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-black text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-sm text-neutral-400 mb-4">
            <Link href="/" className="hover:text-white">{t('nav.home') || 'Home'}</Link>
            <span>/</span>
            <Link href="/shop" className="hover:text-white">{t('shop.shop') || 'Shop'}</Link>
            {hasParent && category.parent && (
              <>
                <span>/</span>
                <Link href={`/category/${category.parent.slug}`} className="hover:text-white">
                  {category.parent.name}
                </Link>
              </>
            )}
            <span>/</span>
            <span className="text-white">{category.name}</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-bold">{category.name}</h1>
          <p className="text-neutral-400 mt-2 max-w-2xl">{category.description}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Subcategories Grid (only for parent categories) */}
        {hasChildren && category.children && (
          <div className="mb-10">
            <h2 className="text-xl font-bold mb-4">
              {t('shop.subcategories')}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {category.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/category/${child.slug}`}
                  className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-neutral-200 hover:border-orange-300 hover:shadow-md transition-all text-center"
                >
                  <span className="text-3xl mb-1">
                    {subCategoryIcons[child.slug] || '🧬'}
                  </span>
                  <span className="font-semibold text-sm text-neutral-900 group-hover:text-orange-600 transition-colors">
                    {child.name}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {tp('shop.productCount', child.productCount)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-8">
          <p className="text-neutral-500">
            {tp('shop.productCount', sortedProducts.length)}
          </p>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-4 py-2 border border-neutral-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
          >
            <option value="featured">{t('shop.popular') || 'Featured'}</option>
            <option value="price-asc">{t('shop.priceAsc') || 'Price: Low to High'}</option>
            <option value="price-desc">{t('shop.priceDesc') || 'Price: High to Low'}</option>
            <option value="name">A-Z</option>
          </select>
        </div>

        {/* Products Grid */}
        {sortedProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {sortedProducts.map((product) => (
              <ProductCard
                key={product.id}
                {...product}
                category={category.name}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-neutral-500 mb-4">{t('shop.noProductsFound')}</p>
            <Link href="/shop" className="text-orange-600 font-medium hover:underline">
              {t('shop.viewAll')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

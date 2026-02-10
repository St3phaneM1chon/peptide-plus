'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ProductCard } from '@/components/shop';

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

interface Category {
  slug: string;
  name: string;
  description: string;
  longDescription: string;
}

interface CategoryPageClientProps {
  category: Category;
  products: Product[];
}

type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'name';

export default function CategoryPageClient({ category, products }: CategoryPageClientProps) {
  const [sortBy, setSortBy] = useState<SortOption>('featured');

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
          <nav className="flex items-center gap-2 text-sm text-neutral-400 mb-4">
            <Link href="/" className="hover:text-white">Home</Link>
            <span>/</span>
            <Link href="/shop" className="hover:text-white">Shop</Link>
            <span>/</span>
            <span className="text-white">{category.name}</span>
          </nav>
          <h1 className="text-3xl md:text-4xl font-bold">{category.name}</h1>
          <p className="text-neutral-400 mt-2 max-w-2xl">{category.description}</p>
        </div>
      </div>

      {/* Products */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-8">
          <p className="text-neutral-500">
            {sortedProducts.length} product{sortedProducts.length !== 1 ? 's' : ''}
          </p>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-4 py-2 border border-neutral-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
          >
            <option value="featured">Featured</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="name">Name A-Z</option>
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
            <p className="text-neutral-500 mb-4">No products found in this category</p>
            <Link href="/shop" className="text-orange-600 font-medium hover:underline">
              View all products
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

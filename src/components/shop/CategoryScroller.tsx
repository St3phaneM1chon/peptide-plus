'use client';

import { useRef } from 'react';
import Link from 'next/link';
import ProductCard from './ProductCard';

interface Product {
  id: string;
  name: string;
  subtitle?: string;
  slug: string;
  price: number;
  comparePrice?: number;
  purity?: number;
  imageUrl?: string;
  isNew?: boolean;
  isBestseller?: boolean;
  inStock?: boolean;
  formats?: {
    id: string;
    name: string;
    price: number;
    comparePrice?: number;
    inStock: boolean;
    stockQuantity: number;
  }[];
}

interface CategoryScrollerProps {
  title: string;
  slug: string;
  products: Product[];
}

export default function CategoryScroller({ title, slug, products }: CategoryScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 300;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (products.length === 0) return null;

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-neutral-900">{title}</h2>
          <div className="flex items-center gap-4">
            {/* Scroll Buttons */}
            <div className="hidden md:flex gap-2">
              <button
                onClick={() => scroll('left')}
                className="p-2 border border-neutral-300 rounded-lg text-neutral-600 hover:bg-neutral-100 transition-colors"
                aria-label="Défiler vers la gauche"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => scroll('right')}
                className="p-2 border border-neutral-300 rounded-lg text-neutral-600 hover:bg-neutral-100 transition-colors"
                aria-label="Défiler vers la droite"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            {/* View All Link */}
            <Link
              href={`/category/${slug}`}
              className="flex items-center gap-1 text-emerald-600 font-medium hover:text-emerald-700 transition-colors"
            >
              Voir tout
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Products Scroller */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="flex-shrink-0 w-64 snap-start"
            >
              <ProductCard {...product} />
            </div>
          ))}
        </div>
      </div>

      {/* Hide scrollbar style */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}

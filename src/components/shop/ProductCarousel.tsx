'use client';

import { useRef } from 'react';
import ProductCard from './ProductCard';
import { useI18n } from '@/i18n/client';

interface ProductCarouselProps {
  products: Array<{
    id: string;
    name: string;
    slug: string;
    price: number;
    purity?: number;
    imageUrl?: string;
    category?: string;
    isNew?: boolean;
    isBestseller?: boolean;
    inStock?: boolean;
    options?: Array<{
      id: string;
      name: string;
      price: number;
      comparePrice?: number;
      inStock: boolean;
      stockQuantity: number;
      image?: string;
    }>;
  }>;
}

export default function ProductCarousel({ products }: ProductCarouselProps) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.7;
    el.scrollBy({
      left: direction === 'right' ? scrollAmount : -scrollAmount,
      behavior: 'smooth',
    });
  };

  if (!products.length) return null;

  return (
    <div className="relative group/carousel">
      {/* Scroll buttons */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 backdrop-blur rounded-full shadow-md flex items-center justify-center hover:bg-white transition-all opacity-0 group-hover/carousel:opacity-100 -translate-x-4 group-hover/carousel:translate-x-2"
        aria-label={t('shop.aria.scrollLeft') || 'Scroll left'}
      >
        <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white/90 backdrop-blur rounded-full shadow-md flex items-center justify-center hover:bg-white transition-all opacity-0 group-hover/carousel:opacity-100 translate-x-4 group-hover/carousel:-translate-x-2"
        aria-label={t('shop.aria.scrollRight') || 'Scroll right'}
      >
        <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Scrollable area */}
      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2 -mx-4 px-4"
      >
        {products.map((product) => (
          <div key={product.id} className="snap-start shrink-0 w-[280px]">
            <ProductCard {...product} />
          </div>
        ))}
      </div>
    </div>
  );
}

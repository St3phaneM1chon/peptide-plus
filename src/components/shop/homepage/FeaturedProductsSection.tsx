'use client';

import Link from 'next/link';
import Image from 'next/image';
import { MotionDiv } from '@/components/koraline';
import { GlassCard } from '@/components/koraline';
import type { FeaturedProductsSection as FeaturedProductsConfig } from '@/lib/homepage-sections';
import type { FeaturedProductData } from '@/lib/homepage-sections';

interface Props {
  config: FeaturedProductsConfig;
  products: FeaturedProductData[];
}

export default function FeaturedProductsSection({ config, products }: Props) {
  if (products.length === 0) return null;

  return (
    <section className="py-16 md:py-24 bg-[var(--k-bg-base)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <MotionDiv animation="slideUp" className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--k-text-primary)] mb-3">
            {config.title}
          </h2>
          {config.subtitle && (
            <p className="text-[var(--k-text-secondary)] text-lg max-w-2xl mx-auto">
              {config.subtitle}
            </p>
          )}
        </MotionDiv>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product, index) => (
            <MotionDiv key={product.id} animation="slideUp" delay={0.05 * index}>
              <GlassCard hoverable>
                <Link href={`/product/${product.slug}`} className="block">
                  {/* Image */}
                  <div className="aspect-square relative overflow-hidden bg-[var(--k-bg-raised)]">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <svg className="w-16 h-16 text-[var(--k-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    )}
                    {/* Featured badge */}
                    {product.isFeatured && (
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--k-accent-indigo)]/20 text-[var(--k-accent-indigo)] backdrop-blur-sm border border-[var(--k-accent-indigo)]/30">
                        Featured
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    {product.category && (
                      <p className="text-xs font-medium text-[var(--k-accent-cyan)] uppercase tracking-wider mb-1">
                        {product.category}
                      </p>
                    )}
                    <h3 className="text-base font-semibold text-[var(--k-text-primary)] line-clamp-2 mb-2">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-[var(--k-text-primary)]">
                        ${product.price.toFixed(2)}
                      </span>
                      {product.compareAtPrice != null && product.compareAtPrice > product.price && (
                        <span className="text-sm text-[var(--k-text-muted)] line-through">
                          ${product.compareAtPrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </GlassCard>
            </MotionDiv>
          ))}
        </div>
      </div>
    </section>
  );
}

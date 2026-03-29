'use client';

/**
 * LiveProductGrid — Fetches and displays real products from the catalog
 * Used by the Puck page builder's FeaturedProducts/ProductGrid sections on public pages.
 */

import { useState, useEffect } from 'react';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
  currency?: { symbol: string };
}

interface LiveProductGridProps {
  title?: string;
  category?: string;
  limit?: number;
}

export default function LiveProductGrid({ title, category, limit = 4 }: LiveProductGridProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (category) params.set('category', category);

    fetch(`/api/products?${params}`)
      .then(res => res.ok ? res.json() : { products: [] })
      .then(data => setProducts((data.products || []).slice(0, limit)))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [limit, category]);

  if (loading) {
    return (
      <div className="space-y-6">
        {title && <h2 className="text-3xl font-bold text-center" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{title}</h2>}
        <div className="grid md:grid-cols-4 gap-6">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden animate-pulse" style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'var(--k-glass-regular, rgba(255,255,255,0.08))' }}>
              <div className="aspect-square" style={{ background: 'rgba(255,255,255,0.04)' }} />
              <div className="p-4 space-y-2">
                <div className="h-4 w-24 rounded bg-white/10" />
                <div className="h-4 w-16 rounded bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="space-y-6">
        {title && <h2 className="text-3xl font-bold text-center" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{title}</h2>}
        <p className="text-center opacity-50" style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>
          Aucun produit disponible pour le moment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {title && <h2 className="text-3xl font-bold text-center" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>{title}</h2>}
      <div className="grid md:grid-cols-4 gap-6">
        {products.map((product) => (
          <a
            key={product.id}
            href={`/shop/products/${product.slug}`}
            className="rounded-xl overflow-hidden group hover:shadow-xl transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'var(--k-glass-regular, rgba(255,255,255,0.08))' }}
          >
            <div className="aspect-square overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
              {product.images?.[0] ? (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl">🛍️</div>
              )}
            </div>
            <div className="p-4 space-y-2">
              <h3 className="font-semibold truncate" style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}>
                {product.name}
              </h3>
              <p className="font-bold" style={{ color: 'var(--k-accent, #6366f1)' }}>
                {product.currency?.symbol || '$'}{product.price.toFixed(2)}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * PRODUCT CARD - Style Shopify Ton sur Ton
 * Carte produit avec hover effects et quick add
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/components/cart/CartDrawer';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  imageUrl?: string;
  secondaryImageUrl?: string;
  vendor?: string;
  badge?: string;
}

interface ProductCardShopifyProps {
  product: Product;
}

export function ProductCardShopify({ product }: ProductCardShopifyProps) {
  const { addItem } = useCart();

  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / product.compareAtPrice!) * 100)
    : 0;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    addItem({
      id: product.id,
      productId: product.id,
      name: product.name,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      imageUrl: product.imageUrl,
    });
  };

  return (
    <article className="product-card">
      {/* Image Container */}
      <Link href={`/cours/${product.slug}`} className="product-card__image">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 300px" />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, #F0F0F0 0%, #E0E0E0 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={0.5}
              stroke="#9E9E9E"
              width="64"
              height="64"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
              />
            </svg>
          </div>
        )}

        {/* Badge */}
        {(product.badge || hasDiscount) && (
          <span
            className={`product-card__badge ${hasDiscount ? 'product-card__badge--sale' : ''}`}
          >
            {hasDiscount ? `-${discountPercent}%` : product.badge}
          </span>
        )}

        {/* Quick Add Button */}
        <div className="product-card__quick-add">
          <button
            onClick={handleQuickAdd}
            className="btn btn-primary btn-full"
            style={{ padding: '12px 16px' }}
          >
            Ajouter au panier
          </button>
        </div>
      </Link>

      {/* Content */}
      <div className="product-card__content">
        {/* Vendor */}
        {product.vendor && (
          <p className="product-card__vendor">{product.vendor}</p>
        )}

        {/* Title */}
        <h3 className="product-card__title">
          <Link href={`/cours/${product.slug}`}>{product.name}</Link>
        </h3>

        {/* Price */}
        <div className="product-card__price">
          <span className="product-card__price-current">
            {product.price.toFixed(2)} $
          </span>
          {hasDiscount && (
            <span className="product-card__price-compare">
              {product.compareAtPrice!.toFixed(2)} $
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export default ProductCardShopify;

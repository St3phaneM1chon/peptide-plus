'use client';

import { getPriorityBadges } from '@/lib/product-badges';
import ProductBadge from './ProductBadge';

interface ProductBadgesProps {
  product: {
    createdAt?: Date | string;
    purchaseCount?: number;
    averageRating?: number;
    reviewCount?: number;
    price?: number;
    compareAtPrice?: number;
    formats?: Array<{
      stockQuantity: number;
      inStock: boolean;
    }>;
    restockedAt?: Date | string;
  };
  maxBadges?: number;
  className?: string;
}

export default function ProductBadges({ product, maxBadges = 2, className = '' }: ProductBadgesProps) {
  const badges = getPriorityBadges(product, maxBadges);

  if (badges.length === 0) return null;

  return (
    <div
      className={`absolute top-2 left-2 z-10 flex flex-col gap-1.5 ${className}`}
      aria-label="Product badges"
    >
      {badges.map((badge, index) => (
        <ProductBadge
          key={`${badge.type}-${index}`}
          type={badge.type}
          discountPercent={badge.discountPercent}
        />
      ))}
    </div>
  );
}

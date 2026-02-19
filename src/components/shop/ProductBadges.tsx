'use client';

import { getPriorityBadges } from '@/lib/product-badges';
import ProductBadge from './ProductBadge';
import { useI18n } from '@/i18n/client';

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
  };
  maxBadges?: number;
  className?: string;
}

export default function ProductBadges({ product, maxBadges = 2, className = '' }: ProductBadgesProps) {
  const { t } = useI18n();
  const badges = getPriorityBadges(product, maxBadges);

  if (badges.length === 0) return null;

  return (
    <div
      className={`absolute top-2 start-2 z-10 flex flex-col gap-1.5 ${className}`}
      aria-label={t('shop.aria.productBadges')}
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

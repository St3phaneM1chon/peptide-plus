/**
 * Product Badge Logic (Server-compatible, no React)
 * Determines which badges to display for a product based on its properties
 */

import type { BadgeType } from '@/components/shop/ProductBadge';

interface ProductBadgeData {
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
  // For back-in-stock detection (would need to add this to Product model)
  restockedAt?: Date | string;
}

interface Badge {
  type: BadgeType;
  discountPercent?: number;
}

/**
 * Get all applicable badges for a product
 */
export function getProductBadges(product: ProductBadgeData): Badge[] {
  const badges: Badge[] = [];

  // 1. SALE - has active discount
  if (product.compareAtPrice && product.price && product.compareAtPrice > product.price) {
    const discountPercent = Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100);
    badges.push({ type: 'sale', discountPercent });
  }

  // 2. NEW - created within last 14 days
  if (product.createdAt) {
    const createdDate = new Date(product.createdAt);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 14) {
      badges.push({ type: 'new' });
    }
  }

  // 3. BACK IN STOCK - restocked within last 7 days
  if (product.restockedAt) {
    const restockedDate = new Date(product.restockedAt);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - restockedDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 7) {
      badges.push({ type: 'back-in-stock' });
    }
  }

  // 4. LOW STOCK - any format has stock > 0 AND <= 5
  if (product.formats && product.formats.length > 0) {
    const hasLowStock = product.formats.some(
      f => f.inStock && f.stockQuantity > 0 && f.stockQuantity <= 5
    );
    if (hasLowStock) {
      badges.push({ type: 'low-stock' });
    }
  }

  // 5. TRENDING - high rating with reviews OR high purchase count recently
  // For now, using simple heuristic: rating >= 4.5 with 10+ reviews
  if (
    product.averageRating &&
    product.reviewCount &&
    parseFloat(product.averageRating.toString()) >= 4.5 &&
    product.reviewCount >= 10
  ) {
    badges.push({ type: 'trending' });
  }

  // 6. BEST SELLER - high total purchase count (threshold: 50+)
  if (product.purchaseCount && product.purchaseCount >= 50) {
    badges.push({ type: 'best-seller' });
  }

  return badges;
}

/**
 * Get prioritized badges (max 2) for display
 * Priority: sale > low-stock > new > best-seller > trending > back-in-stock
 */
export function getPriorityBadges(product: ProductBadgeData, maxBadges = 2): Badge[] {
  const allBadges = getProductBadges(product);

  const priority: BadgeType[] = ['sale', 'low-stock', 'new', 'best-seller', 'trending', 'back-in-stock'];

  const sorted = allBadges.sort((a, b) => {
    return priority.indexOf(a.type) - priority.indexOf(b.type);
  });

  return sorted.slice(0, maxBadges);
}

/**
 * Calculate discount percentage
 */
export function calculateDiscountPercent(price: number, compareAtPrice: number): number {
  if (compareAtPrice <= price) return 0;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

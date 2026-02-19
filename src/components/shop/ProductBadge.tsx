'use client';

import { useI18n } from '@/i18n/client';

export type BadgeType = 'new' | 'trending' | 'low-stock' | 'best-seller' | 'sale' | 'back-in-stock';

interface ProductBadgeProps {
  type: BadgeType;
  discountPercent?: number;
  className?: string;
}

export default function ProductBadge({ type, discountPercent, className = '' }: ProductBadgeProps) {
  const { t } = useI18n();

  const badgeConfig: Record<BadgeType, {
    label: string;
    bgColor: string;
    textColor: string;
    pulseAnimation?: boolean;
  }> = {
    'new': {
      label: t('badges.new') || 'New',
      bgColor: 'bg-green-500',
      textColor: 'text-white',
    },
    'trending': {
      label: t('badges.trending') || 'Trending',
      bgColor: 'bg-amber-500',
      textColor: 'text-white',
    },
    'low-stock': {
      label: t('badges.lowStock') || 'Low Stock',
      bgColor: 'bg-red-500',
      textColor: 'text-white',
      pulseAnimation: true,
    },
    'best-seller': {
      label: t('badges.bestSeller') || 'Best Seller',
      bgColor: 'bg-indigo-600',
      textColor: 'text-white',
    },
    'sale': {
      label: discountPercent ? `-${discountPercent}%` : t('badges.sale') || 'Sale',
      bgColor: 'bg-red-600',
      textColor: 'text-white',
    },
    'back-in-stock': {
      label: t('badges.backInStock') || 'Back in Stock',
      bgColor: 'bg-blue-500',
      textColor: 'text-white',
    },
  };

  const config = badgeConfig[type];

  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide
        ${config.bgColor} ${config.textColor}
        ${config.pulseAnimation ? 'animate-pulse' : ''}
        ${className}
      `}
      aria-label={`${config.label} badge`}
    >
      {config.label}
    </span>
  );
}

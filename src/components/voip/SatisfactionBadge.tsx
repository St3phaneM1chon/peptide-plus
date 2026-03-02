'use client';

/**
 * SatisfactionBadge
 * Shows call satisfaction score as a colored badge.
 */

import { Star } from 'lucide-react';

interface SatisfactionBadgeProps {
  score: number | null;
  size?: 'sm' | 'md';
}

export default function SatisfactionBadge({ score, size = 'sm' }: SatisfactionBadgeProps) {
  if (score === null || score === undefined) return null;

  const color = score >= 4 ? 'text-emerald-600 bg-emerald-50'
    : score >= 3 ? 'text-yellow-600 bg-yellow-50'
    : 'text-red-600 bg-red-50';

  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${color} ${sizeClass}`}>
      <Star className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      {score}/5
    </span>
  );
}

'use client';

import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number; // percentage
    label?: string;
  };
  format?: 'number' | 'currency' | 'percent';
  className?: string;
}

export function StatCard({ label, value, icon: Icon, trend, className = '' }: StatCardProps) {
  const TrendIcon = trend
    ? trend.value > 0
      ? TrendingUp
      : trend.value < 0
        ? TrendingDown
        : Minus
    : null;

  const trendColor = trend
    ? trend.value > 0
      ? 'text-emerald-600'
      : trend.value < 0
        ? 'text-red-500'
        : 'text-slate-400'
    : '';

  return (
    <div className={`bg-white border border-slate-200 rounded-lg p-5 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">{value}</p>
        </div>
        <div className="p-2 bg-slate-50 rounded-lg">
          <Icon className="w-5 h-5 text-slate-600" />
        </div>
      </div>
      {trend && TrendIcon && (
        <div className={`mt-3 flex items-center gap-1 text-sm ${trendColor}`}>
          <TrendIcon className="w-4 h-4" />
          <span className="font-medium">{Math.abs(trend.value)}%</span>
          {trend.label && <span className="text-slate-400 ms-1">{trend.label}</span>}
        </div>
      )}
    </div>
  );
}

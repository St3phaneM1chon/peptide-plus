'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { ExternalLink, Loader2 } from 'lucide-react';

interface BridgeCardProps {
  /** Card title displayed in the header */
  title: string;
  /** Icon displayed next to the title */
  icon?: ReactNode;
  /** Whether the bridge data is loading */
  loading?: boolean;
  /** Whether the target module is enabled */
  enabled?: boolean;
  /** Link to the full page of the source module */
  viewAllHref?: string;
  /** Label for the "View all" link */
  viewAllLabel?: string;
  /** Card content */
  children: ReactNode;
  /** Additional className */
  className?: string;
  /** Compact mode (less padding) */
  compact?: boolean;
}

/**
 * Reusable card component for displaying cross-module bridge data.
 *
 * Features:
 * - Skeleton loading state
 * - Hides completely when the target module is disabled
 * - Consistent styling across all bridges
 * - Optional "View all" link to the target module
 */
export function BridgeCard({
  title,
  icon,
  loading = false,
  enabled = true,
  viewAllHref,
  viewAllLabel,
  children,
  className = '',
  compact = false,
}: BridgeCardProps) {
  // Hide entirely if module is disabled
  if (!enabled && !loading) return null;

  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="text-slate-500 flex-shrink-0">{icon}</span>
          )}
          <h4 className="text-sm font-medium text-slate-700">{title}</h4>
        </div>
        {viewAllHref && !loading && (
          <Link
            href={viewAllHref}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            {viewAllLabel || 'Voir tout'}
            <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>

      {/* Content */}
      <div className={compact ? 'p-3' : 'p-4'}>
        {loading ? <BridgeCardSkeleton /> : children}
      </div>
    </div>
  );
}

/** Skeleton placeholder while bridge data loads */
function BridgeCardSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
        <div className="h-3 bg-slate-200 rounded w-24" />
      </div>
      <div className="h-3 bg-slate-100 rounded w-full" />
      <div className="h-3 bg-slate-100 rounded w-3/4" />
    </div>
  );
}

/** Empty state for bridge cards with no data */
export function BridgeCardEmpty({ message }: { message: string }) {
  return (
    <p className="text-sm text-slate-400 italic">{message}</p>
  );
}

/** Stat row for bridge cards: label + value */
export function BridgeCardStat({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const valueEl = (
    <span className="text-sm font-semibold text-slate-900">{value}</span>
  );

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-slate-500">{label}</span>
      {href ? (
        <Link href={href} className="text-blue-600 hover:text-blue-700">
          {valueEl}
        </Link>
      ) : (
        valueEl
      )}
    </div>
  );
}

/** Mini table row for bridge list items */
export function BridgeCardRow({
  children,
  href,
}: {
  children: ReactNode;
  href?: string;
}) {
  const content = (
    <div className="flex items-center justify-between py-2 px-1 text-sm hover:bg-slate-50 rounded">
      {children}
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

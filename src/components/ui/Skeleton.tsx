/**
 * Reusable Skeleton component for loading states.
 * Provides animated pulse placeholders that match real content layouts.
 *
 * Variants: text, card, image, table-row, stat-card
 */

interface SkeletonProps {
  className?: string;
}

/** Base skeleton block with pulse animation. */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 ${className}`}
      aria-hidden="true"
    />
  );
}

/** Single line of text. Use `className` to control width/height. */
export function SkeletonText({ className = 'h-4 w-full' }: SkeletonProps) {
  return <Skeleton className={className} />;
}

/** Product / generic card skeleton with image area, title, and subtitle. */
export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      <Skeleton className="w-full h-48" />
      <div className="p-4 space-y-3">
        <SkeletonText className="h-4 w-3/4" />
        <SkeletonText className="h-3 w-1/2" />
        <div className="flex items-center justify-between pt-2">
          <SkeletonText className="h-5 w-20" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Square or rectangular image placeholder. */
export function SkeletonImage({ className = 'w-full h-64' }: SkeletonProps) {
  return <Skeleton className={`rounded-lg ${className}`} />;
}

/** A single table row skeleton with multiple columns. */
export function SkeletonTableRow({ columns = 5, className = '' }: SkeletonProps & { columns?: number }) {
  return (
    <div className={`flex items-center gap-4 py-3 px-4 ${className}`}>
      {Array.from({ length: columns }).map((_, i) => (
        <SkeletonText
          key={i}
          className={`h-4 ${i === 0 ? 'w-32' : i === columns - 1 ? 'w-16' : 'w-24'}`}
        />
      ))}
    </div>
  );
}

/** Stat card skeleton matching the admin dashboard / account stats. */
export function SkeletonStatCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-white rounded-xl p-6 border border-gray-200 ${className}`}>
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-lg" />
        <div className="space-y-2 flex-1">
          <SkeletonText className="h-6 w-16" />
          <SkeletonText className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}

import { Skeleton, SkeletonText, SkeletonCard } from '@/components/ui/Skeleton';

/**
 * Category page loading state.
 * Shows category header and product grid skeleton placeholders.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <SkeletonText className="h-3 w-12" />
          <SkeletonText className="h-3 w-3" />
          <SkeletonText className="h-3 w-24" />
        </div>

        {/* Category header */}
        <div className="mb-8">
          <SkeletonText className="h-8 w-56 mb-3" />
          <SkeletonText className="h-4 w-96" />
        </div>

        {/* Sort/filter bar */}
        <div className="flex items-center justify-between mb-6">
          <SkeletonText className="h-4 w-32" />
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>

        {/* Product grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

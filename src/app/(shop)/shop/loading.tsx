import { Skeleton, SkeletonText, SkeletonCard } from '@/components/ui/Skeleton';

/**
 * Shop page loading state.
 * Mirrors the product grid layout with filter sidebar and product card skeletons.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-8">
          <SkeletonText className="h-8 w-56 mb-3" />
          <SkeletonText className="h-4 w-96" />
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar filters */}
          <aside className="w-full lg:w-60 flex-shrink-0 space-y-6">
            {/* Category filter */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <SkeletonText className="h-5 w-28 mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonText key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>

            {/* Sort / price filter */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <SkeletonText className="h-5 w-20 mb-4" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </aside>

          {/* Product grid */}
          <div className="flex-1">
            {/* Sort bar */}
            <div className="flex items-center justify-between mb-6">
              <SkeletonText className="h-4 w-32" />
              <Skeleton className="h-10 w-40 rounded-lg" />
            </div>

            {/* Product cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 9 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

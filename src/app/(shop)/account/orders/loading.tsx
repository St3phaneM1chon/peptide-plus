import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

/**
 * Orders list loading state.
 * Matches the real page: breadcrumb, heading, filter bar, then order cards.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-2">
          <SkeletonText className="h-3 w-12" />
          <SkeletonText className="h-3 w-3" />
          <SkeletonText className="h-3 w-16" />
          <SkeletonText className="h-3 w-3" />
          <SkeletonText className="h-3 w-20" />
        </div>

        {/* Title */}
        <SkeletonText className="h-8 w-48 mb-8" />

        {/* Filter bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <Skeleton className="h-10 flex-1 rounded-lg" />
            <Skeleton className="h-10 w-40 rounded-lg" />
            <Skeleton className="h-10 w-40 rounded-lg" />
          </div>
        </div>

        {/* Results count */}
        <SkeletonText className="h-4 w-24 mb-4" />

        {/* Order cards */}
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Order header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-6">
                    <div className="space-y-1">
                      <SkeletonText className="h-3 w-16" />
                      <SkeletonText className="h-4 w-28" />
                    </div>
                    <div className="space-y-1">
                      <SkeletonText className="h-3 w-10" />
                      <SkeletonText className="h-4 w-32" />
                    </div>
                    <div className="space-y-1">
                      <SkeletonText className="h-3 w-10" />
                      <SkeletonText className="h-4 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-7 w-24 rounded-full" />
                </div>
              </div>

              {/* Order items */}
              <div className="px-6 py-4 space-y-3">
                {Array.from({ length: 2 }).map((_, j) => (
                  <div key={j} className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-12 h-12 rounded-lg" />
                      <div className="space-y-1">
                        <SkeletonText className="h-4 w-40" />
                        <SkeletonText className="h-3 w-24" />
                      </div>
                    </div>
                    <SkeletonText className="h-4 w-16" />
                  </div>
                ))}
              </div>

              {/* Order actions */}
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <SkeletonText className="h-3 w-32" />
                <div className="flex gap-3">
                  <SkeletonText className="h-4 w-24" />
                  <SkeletonText className="h-4 w-28" />
                  <SkeletonText className="h-4 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

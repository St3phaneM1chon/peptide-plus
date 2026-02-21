import { Skeleton, SkeletonText, SkeletonStatCard } from '@/components/ui/Skeleton';

/**
 * Rewards page loading state.
 * Shows reward program overview skeleton.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="text-center mb-12">
          <SkeletonText className="h-8 w-64 mx-auto mb-3" />
          <SkeletonText className="h-4 w-96 mx-auto" />
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonStatCard key={i} />
          ))}
        </div>

        {/* Content sections */}
        <div className="space-y-8">
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <SkeletonText className="h-6 w-48 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <SkeletonText className="h-4 w-48" />
                    <SkeletonText className="h-3 w-32" />
                  </div>
                  <SkeletonText className="h-5 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

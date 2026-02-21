import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

/**
 * Learn/Articles page loading state.
 * Shows article card grid skeleton placeholders.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-8">
          <SkeletonText className="h-8 w-56 mb-3" />
          <SkeletonText className="h-4 w-80" />
        </div>

        {/* Category filter */}
        <div className="flex gap-3 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-full" />
          ))}
        </div>

        {/* Article grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl overflow-hidden border border-gray-200">
              <Skeleton className="w-full h-48" />
              <div className="p-5 space-y-3">
                <SkeletonText className="h-5 w-3/4" />
                <SkeletonText className="h-3 w-full" />
                <SkeletonText className="h-3 w-2/3" />
                <div className="flex items-center gap-2 pt-2">
                  <Skeleton className="w-6 h-6 rounded-full" />
                  <SkeletonText className="h-3 w-24" />
                  <SkeletonText className="h-3 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

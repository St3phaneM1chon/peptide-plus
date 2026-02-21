import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

/**
 * FAQ page loading state.
 * Shows accordion-style FAQ skeleton placeholders.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-white py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="text-center mb-12">
          <SkeletonText className="h-8 w-64 mx-auto mb-3" />
          <SkeletonText className="h-4 w-96 mx-auto" />
        </div>

        {/* Search bar */}
        <Skeleton className="h-12 w-full max-w-lg mx-auto rounded-lg mb-8" />

        {/* Category tabs */}
        <div className="flex gap-3 mb-8 justify-center">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-full" />
          ))}
        </div>

        {/* FAQ items */}
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <SkeletonText className="h-5 w-3/4" />
                <Skeleton className="w-5 h-5 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

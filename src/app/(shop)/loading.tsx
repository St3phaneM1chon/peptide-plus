import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

/**
 * Shop layout loading state.
 * Shows a minimal page shell while the route content loads.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero / banner placeholder */}
      <Skeleton className="w-full h-64 rounded-none" />

      {/* Content area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-4 mb-8">
          <SkeletonText className="h-8 w-64" />
          <SkeletonText className="h-4 w-96" />
        </div>

        {/* Generic content blocks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="w-full h-40 rounded-lg" />
              <SkeletonText className="h-4 w-3/4" />
              <SkeletonText className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

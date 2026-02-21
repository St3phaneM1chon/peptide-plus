import { Skeleton, SkeletonText, SkeletonCard } from '@/components/ui/Skeleton';

/**
 * Search page loading state.
 * Shows search bar skeleton and product grid placeholders.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Search header */}
        <div className="mb-8">
          <SkeletonText className="h-8 w-48 mb-4" />
          <Skeleton className="h-12 w-full max-w-xl rounded-lg" />
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-4 mb-6">
          <SkeletonText className="h-4 w-24" />
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
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

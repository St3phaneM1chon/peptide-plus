import { Skeleton, SkeletonText, SkeletonCard } from '@/components/ui/Skeleton';

/**
 * Product detail page loading state.
 * Matches the two-column layout: image gallery on left, product info on right.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <SkeletonText className="h-3 w-12" />
          <SkeletonText className="h-3 w-3" />
          <SkeletonText className="h-3 w-20" />
          <SkeletonText className="h-3 w-3" />
          <SkeletonText className="h-3 w-32" />
        </div>

        {/* Main product section: image + info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image gallery */}
          <div className="space-y-4">
            <Skeleton className="w-full aspect-square rounded-xl" />
            <div className="flex gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="w-20 h-20 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Product info */}
          <div className="space-y-6">
            {/* Category badge */}
            <Skeleton className="h-6 w-24 rounded-full" />

            {/* Title */}
            <div className="space-y-2">
              <SkeletonText className="h-8 w-3/4" />
              <SkeletonText className="h-5 w-1/2" />
            </div>

            {/* Price */}
            <SkeletonText className="h-8 w-28" />

            {/* Purity / specs badges */}
            <div className="flex gap-3">
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-32 rounded-lg" />
            </div>

            {/* Format selector */}
            <div className="space-y-3">
              <SkeletonText className="h-4 w-32" />
              <div className="flex gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-28 rounded-lg" />
                ))}
              </div>
            </div>

            {/* Add to cart */}
            <Skeleton className="h-14 w-full rounded-xl" />

            {/* Description lines */}
            <div className="space-y-2 pt-4 border-t border-gray-200">
              <SkeletonText className="h-5 w-36 mb-3" />
              <SkeletonText className="h-3 w-full" />
              <SkeletonText className="h-3 w-full" />
              <SkeletonText className="h-3 w-5/6" />
              <SkeletonText className="h-3 w-4/6" />
            </div>

            {/* Specifications table */}
            <div className="space-y-2 pt-4 border-t border-gray-200">
              <SkeletonText className="h-5 w-32 mb-3" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <SkeletonText className="h-3 w-28" />
                  <SkeletonText className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Related products */}
        <div className="mt-16">
          <SkeletonText className="h-6 w-48 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

/**
 * Checkout page loading state.
 * Mirrors the two-column layout: form on left (lg:col-span-2), order summary on right.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <SkeletonText className="h-6 w-32" />
          </div>
          <SkeletonText className="h-4 w-28" />
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-full" />
              <SkeletonText className="h-4 w-16" />
              {i < 2 && <Skeleton className="w-12 h-0.5" />}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
              <SkeletonText className="h-6 w-48 mb-4" />

              {/* Form fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <SkeletonText className="h-4 w-20" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
                <div className="space-y-2">
                  <SkeletonText className="h-4 w-20" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              </div>

              <div className="space-y-2">
                <SkeletonText className="h-4 w-16" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>

              <div className="space-y-2">
                <SkeletonText className="h-4 w-24" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <SkeletonText className="h-4 w-12" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
                <div className="space-y-2">
                  <SkeletonText className="h-4 w-20" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <SkeletonText className="h-4 w-24" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
                <div className="space-y-2">
                  <SkeletonText className="h-4 w-20" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              </div>

              {/* Continue button */}
              <div className="flex justify-between items-center pt-4">
                <SkeletonText className="h-4 w-20" />
                <Skeleton className="h-12 w-44 rounded-lg" />
              </div>
            </div>
          </div>

          {/* Order summary sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <SkeletonText className="h-5 w-32 mb-4" />

              {/* Cart items */}
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="w-16 h-16 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <SkeletonText className="h-4 w-full" />
                    <SkeletonText className="h-3 w-20" />
                  </div>
                  <SkeletonText className="h-4 w-14" />
                </div>
              ))}

              {/* Promo code */}
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-10 flex-1 rounded-lg" />
                <Skeleton className="h-10 w-20 rounded-lg" />
              </div>

              {/* Totals */}
              <div className="space-y-3 border-t border-gray-200 pt-4">
                <div className="flex justify-between">
                  <SkeletonText className="h-4 w-16" />
                  <SkeletonText className="h-4 w-16" />
                </div>
                <div className="flex justify-between">
                  <SkeletonText className="h-4 w-16" />
                  <SkeletonText className="h-4 w-12" />
                </div>
                <div className="flex justify-between">
                  <SkeletonText className="h-4 w-10" />
                  <SkeletonText className="h-4 w-14" />
                </div>
                <div className="flex justify-between pt-3 border-t border-gray-200">
                  <SkeletonText className="h-6 w-12" />
                  <SkeletonText className="h-6 w-20" />
                </div>
              </div>

              {/* Delivery estimate */}
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Skeleton, SkeletonText, SkeletonStatCard } from '@/components/ui/Skeleton';

/**
 * Account dashboard loading state.
 * Matches the real page: dark header with avatar, 4 stat cards, 8 quick-action cards.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dark header section */}
      <section className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-black text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-full bg-neutral-700" />
            <div className="space-y-2">
              <SkeletonText className="h-7 w-48 bg-neutral-700" />
              <SkeletonText className="h-4 w-36 bg-neutral-700" />
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 4 stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonStatCard key={i} />
          ))}
        </div>

        {/* Quick actions row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <SkeletonText className="h-4 w-28" />
                  <SkeletonText className="h-3 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick actions row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <SkeletonText className="h-4 w-28" />
                  <SkeletonText className="h-3 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent order */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <SkeletonText className="h-5 w-32" />
            <SkeletonText className="h-4 w-20" />
          </div>
          <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
            <div className="flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-lg" />
              <div className="space-y-2">
                <SkeletonText className="h-4 w-32" />
                <SkeletonText className="h-3 w-24" />
              </div>
            </div>
            <div className="space-y-2 text-end">
              <SkeletonText className="h-5 w-16 ms-auto" />
              <Skeleton className="h-6 w-20 rounded-full ms-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

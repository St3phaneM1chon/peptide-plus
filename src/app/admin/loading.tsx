import { Skeleton, SkeletonText, SkeletonStatCard, SkeletonTableRow } from '@/components/ui/Skeleton';

/**
 * Admin dashboard loading state.
 * Matches the DashboardClient layout: header with actions, 4 stat cards,
 * recent orders table, and recent users list.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <SkeletonText className="h-7 w-40" />
          <SkeletonText className="h-4 w-64" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
      </div>

      {/* Stats grid: 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>

      {/* Secondary stats: 3 smaller cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="space-y-2 flex-1">
                <SkeletonText className="h-5 w-12" />
                <SkeletonText className="h-3 w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column section: recent orders + recent users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent orders table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <SkeletonText className="h-5 w-36" />
            <SkeletonText className="h-4 w-20" />
          </div>
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonTableRow key={i} columns={4} className="px-6" />
            ))}
          </div>
        </div>

        {/* Recent users list */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <SkeletonText className="h-5 w-32" />
            <SkeletonText className="h-4 w-20" />
          </div>
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3">
                <Skeleton className="w-9 h-9 rounded-full" />
                <div className="space-y-1 flex-1">
                  <SkeletonText className="h-4 w-32" />
                  <SkeletonText className="h-3 w-44" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

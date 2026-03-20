import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function TutorielsLoading() {
  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="space-y-2">
        <SkeletonText className="h-7 w-48" />
        <SkeletonText className="h-4 w-80" />
      </div>

      <div className="flex gap-4" style={{ height: 'calc(100vh - 220px)' }}>
        {/* Sidebar skeleton */}
        <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-gray-200 p-3 space-y-2">
          <Skeleton className="h-9 w-full rounded-lg" />
          <SkeletonText className="h-3 w-32" />
          <div className="space-y-1 mt-4">
            {Array.from({ length: 13 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-2">
                <Skeleton className="w-4 h-4 rounded" />
                <Skeleton className="w-4 h-4 rounded" />
                <SkeletonText className="h-4 flex-1" />
                <SkeletonText className="h-3 w-4" />
              </div>
            ))}
          </div>
        </div>

        {/* Content skeleton */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-8 space-y-4">
          <SkeletonText className="h-8 w-64" />
          <Skeleton className="h-px w-full" />
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonText key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

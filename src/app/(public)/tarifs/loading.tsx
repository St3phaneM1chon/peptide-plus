import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <SkeletonText className="h-8 w-32 mb-2" />
      <SkeletonText className="h-4 w-80 mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <SkeletonText className="h-6 w-24" />
            <SkeletonText className="h-10 w-32" />
            <div className="space-y-2 pt-4 border-t">
              {Array.from({ length: 5 }).map((_, j) => (
                <SkeletonText key={j} className="h-3 w-full" />
              ))}
            </div>
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

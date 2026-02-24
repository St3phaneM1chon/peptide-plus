import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <SkeletonText className="h-8 w-56 mb-2" />
      <SkeletonText className="h-4 w-96 mb-6" />
      <div className="flex gap-3 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-200 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <SkeletonText className="h-4 w-32" />
            </div>
            <SkeletonText className="h-5 w-2/3" />
            <SkeletonText className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

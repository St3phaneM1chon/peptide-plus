import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <SkeletonText className="h-8 w-48 mb-2" />
      <SkeletonText className="h-4 w-96 mb-8" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-200 flex items-center justify-between">
            <div className="space-y-2">
              <SkeletonText className="h-5 w-48" />
              <SkeletonText className="h-3 w-32" />
            </div>
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <SkeletonText className="h-8 w-40 mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonText className="h-3 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-4">
          <SkeletonText className="h-5 w-32" />
          <div className="flex items-center gap-3">
            <Skeleton className="w-16 h-16 rounded-lg" />
            <div className="flex-1 space-y-2">
              <SkeletonText className="h-4 w-3/4" />
              <SkeletonText className="h-4 w-20" />
            </div>
          </div>
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

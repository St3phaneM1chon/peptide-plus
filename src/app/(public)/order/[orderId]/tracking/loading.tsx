import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <SkeletonText className="h-8 w-56 mb-6" />
      <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-6">
        <div className="flex items-center justify-between">
          <SkeletonText className="h-5 w-32" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <SkeletonText className="h-4 w-40" />
                <SkeletonText className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

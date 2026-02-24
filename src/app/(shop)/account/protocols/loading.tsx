import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <SkeletonText className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-200 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <SkeletonText className="h-5 w-40" />
            </div>
            <SkeletonText className="h-4 w-full" />
            <SkeletonText className="h-4 w-2/3" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

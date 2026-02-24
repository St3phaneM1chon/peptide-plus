import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <SkeletonText className="h-8 w-40" />
      <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3">
            <div className="space-y-1">
              <SkeletonText className="h-4 w-32" />
              <SkeletonText className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

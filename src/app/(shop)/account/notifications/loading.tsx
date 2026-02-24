import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <SkeletonText className="h-8 w-48" />
      <div className="bg-white rounded-xl border border-gray-200 divide-y">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <SkeletonText className="h-4 w-2/3" />
              <SkeletonText className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

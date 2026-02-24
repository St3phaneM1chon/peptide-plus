import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <SkeletonText className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-200 space-y-3">
            <SkeletonText className="h-4 w-32" />
            <SkeletonText className="h-4 w-full" />
            <SkeletonText className="h-4 w-2/3" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

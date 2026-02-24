import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <SkeletonText className="h-8 w-40" />
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div className="space-y-2">
            <SkeletonText className="h-5 w-40" />
            <SkeletonText className="h-3 w-32" />
          </div>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <SkeletonText className="h-3 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

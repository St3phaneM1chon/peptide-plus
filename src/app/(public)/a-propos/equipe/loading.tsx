import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <SkeletonText className="h-8 w-48 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="text-center space-y-3">
            <Skeleton className="w-32 h-32 rounded-full mx-auto" />
            <SkeletonText className="h-5 w-32 mx-auto" />
            <SkeletonText className="h-3 w-24 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

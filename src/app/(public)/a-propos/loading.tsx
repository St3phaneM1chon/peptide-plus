import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <Skeleton className="w-full h-48 rounded-xl mb-8" />
      <SkeletonText className="h-8 w-48 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonText key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

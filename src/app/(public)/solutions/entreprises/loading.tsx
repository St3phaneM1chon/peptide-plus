import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <Skeleton className="w-full h-48 rounded-xl mb-8" />
      <SkeletonText className="h-8 w-56 mb-4" />
      <div className="space-y-3 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonText key={i} className="h-4 w-full" />
        ))}
      </div>
      <Skeleton className="h-12 w-48 rounded-lg" />
    </div>
  );
}

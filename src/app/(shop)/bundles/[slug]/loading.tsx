import { Skeleton, SkeletonText, SkeletonCard } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
        <Skeleton className="w-full h-80 rounded-xl" />
        <div className="space-y-4">
          <SkeletonText className="h-8 w-2/3" />
          <SkeletonText className="h-4 w-full" />
          <SkeletonText className="h-4 w-3/4" />
          <SkeletonText className="h-6 w-24" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
      <SkeletonText className="h-6 w-40 mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

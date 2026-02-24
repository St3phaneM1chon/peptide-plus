import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <Skeleton className="w-full h-64 rounded-xl mb-6" />
      <SkeletonText className="h-10 w-2/3 mb-3" />
      <div className="flex items-center gap-3 mb-8">
        <Skeleton className="w-10 h-10 rounded-full" />
        <SkeletonText className="h-4 w-32" />
        <SkeletonText className="h-4 w-24" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonText key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

import { Skeleton, SkeletonText, SkeletonStatCard } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <SkeletonText className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
      <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-3">
        <SkeletonText className="h-5 w-40" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </div>
  );
}

import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <SkeletonText className="h-8 w-56 mb-2" />
      <SkeletonText className="h-4 w-96 mb-8" />
      <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <SkeletonText className="h-3 w-32" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}

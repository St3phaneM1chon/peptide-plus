import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-md mx-auto px-4 py-12 animate-pulse">
      <SkeletonText className="h-8 w-48 mb-6" />
      <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
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

import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <SkeletonText className="h-8 w-48 mb-2" />
      <SkeletonText className="h-4 w-80 mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <Skeleton className="w-full h-40" />
            <div className="p-4 space-y-3">
              <SkeletonText className="h-5 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

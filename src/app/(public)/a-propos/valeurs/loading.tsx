import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <SkeletonText className="h-8 w-48 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-6 border border-gray-200 space-y-3">
            <Skeleton className="w-12 h-12 rounded-lg" />
            <SkeletonText className="h-5 w-32" />
            <SkeletonText className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

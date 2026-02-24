import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <SkeletonText className="h-8 w-32 mb-2" />
      <SkeletonText className="h-4 w-64 mb-6" />
      <Skeleton className="h-12 w-full max-w-xl rounded-lg mb-8" />
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-200">
            <SkeletonText className="h-5 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

import { Skeleton, SkeletonText, SkeletonTableRow } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <SkeletonText className="h-8 w-56 mb-2" />
      <SkeletonText className="h-4 w-96 mb-6" />
      <Skeleton className="h-10 w-full max-w-sm rounded-lg mb-6" />
      <div className="bg-white rounded-xl border border-gray-200 divide-y">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonTableRow key={i} columns={4} />
        ))}
      </div>
    </div>
  );
}

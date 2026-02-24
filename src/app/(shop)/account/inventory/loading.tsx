import { Skeleton, SkeletonText, SkeletonTableRow } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <SkeletonText className="h-8 w-48" />
      <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
      <div className="bg-white rounded-xl border border-gray-200 divide-y">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonTableRow key={i} columns={5} />
        ))}
      </div>
    </div>
  );
}

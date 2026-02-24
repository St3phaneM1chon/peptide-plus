import { SkeletonText, SkeletonTableRow } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <SkeletonText className="h-8 w-40" />
      <div className="bg-white rounded-xl border border-gray-200 divide-y">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonTableRow key={i} columns={5} />
        ))}
      </div>
    </div>
  );
}

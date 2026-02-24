import { SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto p-6 animate-pulse">
      <SkeletonText className="h-8 w-32 mb-6" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonText key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

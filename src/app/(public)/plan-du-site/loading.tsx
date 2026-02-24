import { SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <SkeletonText className="h-8 w-48 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <SkeletonText className="h-5 w-32" />
            {Array.from({ length: 5 }).map((_, j) => (
              <SkeletonText key={j} className="h-4 w-40" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

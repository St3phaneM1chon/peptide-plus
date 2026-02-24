import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center animate-pulse">
      <Skeleton className="w-16 h-16 rounded-full mx-auto mb-6" />
      <SkeletonText className="h-8 w-64 mx-auto mb-4" />
      <SkeletonText className="h-4 w-96 mx-auto mb-8" />
      <Skeleton className="h-12 w-48 rounded-lg mx-auto" />
    </div>
  );
}

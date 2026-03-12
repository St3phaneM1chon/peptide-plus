import { Suspense } from 'react';
import MediaAnalyticsClient from './MediaAnalyticsClient';

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
    </div>
  );
}

export default function MediaAnalyticsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <MediaAnalyticsClient />
    </Suspense>
  );
}

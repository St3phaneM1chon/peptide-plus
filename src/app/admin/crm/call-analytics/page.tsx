import { Suspense } from 'react';
import CallAnalyticsClient from './CallAnalyticsClient';

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
    </div>
  );
}

export default function CallAnalyticsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CallAnalyticsClient />
    </Suspense>
  );
}

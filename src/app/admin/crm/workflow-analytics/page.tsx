import { Suspense } from 'react';
import WorkflowAnalyticsClient from './WorkflowAnalyticsClient';

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
    </div>
  );
}

export default function WorkflowAnalyticsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <WorkflowAnalyticsClient />
    </Suspense>
  );
}

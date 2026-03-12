import { Suspense } from 'react';
import AttributionClient from './AttributionClient';

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
    </div>
  );
}

export default function AttributionPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AttributionClient />
    </Suspense>
  );
}

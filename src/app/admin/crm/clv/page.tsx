import { Suspense } from 'react';
import CLVClient from './CLVClient';

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
    </div>
  );
}

export default function CLVPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CLVClient />
    </Suspense>
  );
}

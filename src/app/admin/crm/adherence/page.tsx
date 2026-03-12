import { Suspense } from 'react';
import AdherenceClient from './AdherenceClient';

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );
}

export default function AdherencePage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AdherenceClient />
    </Suspense>
  );
}

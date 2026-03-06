import { Suspense } from 'react';
import MfaVerifyClient from './MfaVerifyClient';

export default function MfaVerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    }>
      <MfaVerifyClient />
    </Suspense>
  );
}

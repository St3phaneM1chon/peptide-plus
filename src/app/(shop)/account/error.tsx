'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Account page error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
      <p className="text-gray-600 mb-6">
        We encountered an error loading your account. Please try again.
      </p>
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Return to Shop
        </Link>
      </div>
    </div>
  );
}

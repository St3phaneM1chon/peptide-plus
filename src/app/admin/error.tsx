'use client';

import { useEffect } from 'react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Panel Error</h2>
        <p className="text-gray-600 mb-4">
          An error occurred in the admin panel.
          {error.digest && (
            <span className="block text-sm text-gray-400 mt-1">
              Error ID: {error.digest}
            </span>
          )}
        </p>
        <button
          onClick={reset}
          className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

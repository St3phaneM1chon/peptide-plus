'use client';

import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-gray-600 mb-6">{error.message || 'An unexpected error occurred.'}</p>
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
        >
          Try again
        </button>
        <Link href="/" className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
          Go home
        </Link>
      </div>
    </div>
  );
}

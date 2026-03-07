'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <h2 className="text-xl font-semibold text-red-600 mb-4">Une erreur est survenue</h2>
      <p className="text-gray-600 mb-6">{error.message || 'Erreur inattendue'}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
      >
        Réessayer
      </button>
    </div>
  );
}

'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <p className="text-red-600 text-sm">{error.message}</p>
      <button onClick={reset} className="text-sm text-teal-600 hover:underline">
        Réessayer
      </button>
    </div>
  );
}

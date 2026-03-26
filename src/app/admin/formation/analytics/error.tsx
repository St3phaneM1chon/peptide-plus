'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
      <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-[var(--k-text-primary)] mb-2">
        Erreur de chargement
      </h2>
      <p className="text-sm text-slate-500 mb-6 max-w-md">
        {error.message || 'Une erreur inattendue est survenue lors du chargement des analytiques.'}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Reessayer
      </button>
    </div>
  );
}

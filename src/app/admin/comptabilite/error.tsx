'use client';

import { useEffect } from 'react';

export default function ComptabiliteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erreur module comptabilite:', error);
  }, [error]);

  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 max-w-lg w-full text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-slate-900 mb-2">
          Une erreur est survenue dans le module comptabilit&eacute;
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Veuillez r&eacute;essayer. Si le probl&egrave;me persiste, contactez le support technique.
        </p>

        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
            />
          </svg>
          R&eacute;essayer
        </button>

        <details className="mt-6 text-left">
          <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
            D&eacute;tails techniques
          </summary>
          <pre className="mt-2 p-3 bg-slate-50 rounded-lg text-xs text-slate-600 overflow-auto max-h-32 border border-slate-200">
            {error.message}
            {error.digest && `\nDigest: ${error.digest}`}
          </pre>
        </details>
      </div>
    </div>
  );
}

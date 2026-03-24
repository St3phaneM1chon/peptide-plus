'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/admin';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Portal Config Error]', error);
  }, [error]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-3 rounded-full bg-red-50 mb-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800 mb-2">
          Erreur de chargement
        </h2>
        <p className="text-sm text-slate-500 mb-6 max-w-md">
          {error.message || 'Une erreur est survenue lors du chargement de la configuration du portail.'}
        </p>
        <Button variant="primary" onClick={reset}>
          Reessayer
        </Button>
      </div>
    </div>
  );
}

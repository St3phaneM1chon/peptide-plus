'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
      <h2 className="text-xl font-semibold mb-2">Une erreur est survenue</h2>
      <p className="text-muted-foreground mb-4">{error.message || 'Erreur inattendue'}</p>
      <button onClick={reset} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
        Reessayer
      </button>
    </div>
  );
}

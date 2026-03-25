'use client';

import { Users } from 'lucide-react';

export default function CohortePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
        <Users className="h-8 w-8 text-indigo-500" /> Ma cohorte
      </h1>
      <p className="text-muted-foreground mb-8">Votre groupe d&apos;apprentissage synchronise.</p>

      <div className="text-center py-12 rounded-xl border">
        <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-2">Aucune cohorte active</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Vous n&apos;etes pas encore membre d&apos;une cohorte. Votre administrateur peut vous ajouter a un groupe de formation synchronise.
        </p>
      </div>
    </div>
  );
}

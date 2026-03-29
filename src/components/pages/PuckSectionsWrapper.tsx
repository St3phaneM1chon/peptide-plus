'use client';

import dynamic from 'next/dynamic';

const PuckSectionRenderer = dynamic(
  () => import('./PuckSectionRenderer'),
  { ssr: false, loading: () => <div className="py-20 text-center opacity-40">Chargement...</div> }
);

export default function PuckSectionsWrapper({ sections }: { sections: unknown }) {
  return <PuckSectionRenderer sections={sections} />;
}

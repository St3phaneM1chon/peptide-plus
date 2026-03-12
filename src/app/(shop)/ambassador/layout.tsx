export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Programme ambassadeur',
  description: 'Rejoignez le programme ambassadeur BioCycle Peptides et gagnez jusqu\'à 20 % de commission en partageant des peptides de recherche de confiance.',
  openGraph: {
    title: 'Programme ambassadeur | BioCycle Peptides',
    description: 'Gagnez jusqu\'à 20 % de commission en partageant des peptides de recherche de confiance.',
    url: 'https://biocyclepeptides.com/ambassador',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function AmbassadorLayout({ children }: { children: React.ReactNode }) {
  return children;
}

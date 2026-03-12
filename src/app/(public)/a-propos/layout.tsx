export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'À propos de BioCycle Peptides',
  description: 'Source canadienne de confiance pour les peptides de recherche de haute pureté. Fondée à Montréal, BioCycle Peptides livre des composés testés par des tiers avec documentation COA complète.',
  openGraph: {
    title: 'À propos de BioCycle Peptides',
    description: 'Source canadienne de confiance pour les peptides de recherche de haute pureté. Fondée à Montréal.',
    url: 'https://biocyclepeptides.com/a-propos',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}

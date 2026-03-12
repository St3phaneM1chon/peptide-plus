import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Actualités',
  description: 'Restez informé des dernières nouvelles, lancements de produits et mises à jour de recherche de BioCycle Peptides.',
  openGraph: {
    title: 'Actualités | BioCycle Peptides',
    description: 'Dernières nouvelles, lancements de produits et mises à jour de recherche.',
    url: 'https://biocyclepeptides.com/actualites',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function ActualitesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

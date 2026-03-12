import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Comparer les peptides',
  description: 'Comparaison côte à côte des peptides de recherche BioCycle. Comparez pureté, prix, formats et spécifications.',
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Comparer les peptides | BioCycle Peptides',
    description: 'Comparaison côte à côte des peptides de recherche BioCycle.',
    url: 'https://biocyclepeptides.com/compare',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}

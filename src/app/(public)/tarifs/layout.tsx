import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tarifs',
  description: 'Consultez les tarifs BioCycle Peptides. Prix compétitifs sur les peptides de recherche premium avec rabais de volume et options d\'abonnement.',
  openGraph: {
    title: 'Tarifs | BioCycle Peptides',
    description: 'Prix compétitifs sur les peptides de recherche premium avec rabais de volume.',
    url: 'https://biocyclepeptides.com/tarifs',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function TarifsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

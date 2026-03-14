import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nos clients',
  description: 'Découvrez les entreprises et chercheurs qui font confiance à BioCycle Peptides pour leurs peptides de recherche.',
  openGraph: {
    title: 'Nos clients | BioCycle Peptides',
    description: 'Les entreprises et chercheurs qui font confiance à BioCycle Peptides.',
    url: 'https://biocyclepeptides.com/clients',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function ClientsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Références clients',
  description: 'Découvrez les entreprises de 8 industries et 12 pays qui font confiance à BioCycle Peptides pour leurs peptides de recherche.',
  openGraph: {
    title: 'Références clients | BioCycle Peptides',
    description: 'Découvrez les entreprises qui font confiance à BioCycle Peptides.',
    url: 'https://biocyclepeptides.com/clients/references',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function ReferencesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

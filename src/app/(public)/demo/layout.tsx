import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Demander une démo',
  description: 'Demandez une démonstration personnalisée des produits et services BioCycle Peptides pour vos besoins de recherche.',
  openGraph: {
    title: 'Demander une démo | BioCycle Peptides',
    description: 'Démonstration personnalisée des produits et services BioCycle Peptides.',
    url: 'https://biocyclepeptides.com/demo',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}

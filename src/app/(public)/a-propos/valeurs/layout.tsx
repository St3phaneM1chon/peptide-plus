import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nos valeurs',
  description: 'Les valeurs fondamentales de BioCycle Peptides : intégrité scientifique, qualité, transparence et engagement envers la communauté de recherche.',
  openGraph: {
    title: 'Nos valeurs | BioCycle Peptides',
    description: 'Intégrité scientifique, qualité, transparence et engagement envers la recherche.',
    url: 'https://biocyclepeptides.com/a-propos/valeurs',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function ValeursLayout({ children }: { children: React.ReactNode }) {
  return children;
}

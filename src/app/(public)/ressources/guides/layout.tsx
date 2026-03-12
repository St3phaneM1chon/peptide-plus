import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Guides de recherche',
  description: 'Accédez aux guides complets sur la manipulation, le stockage, la reconstitution et les meilleures pratiques pour les peptides de recherche.',
  openGraph: {
    title: 'Guides de recherche | BioCycle Peptides',
    description: 'Guides complets sur la manipulation, le stockage et la reconstitution des peptides.',
    url: 'https://biocyclepeptides.com/ressources/guides',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

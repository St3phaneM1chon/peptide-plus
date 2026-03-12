import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Solutions',
  description: 'Solutions peptidiques sur mesure pour les entreprises, les particuliers et les partenaires dans plusieurs industries.',
  openGraph: {
    title: 'Solutions | BioCycle Peptides',
    description: 'Solutions peptidiques sur mesure pour entreprises, particuliers et partenaires.',
    url: 'https://biocyclepeptides.com/solutions',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function SolutionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

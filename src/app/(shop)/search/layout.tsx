import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rechercher des peptides',
  description: 'Recherchez dans le catalogue BioCycle Peptides. Trouvez des peptides par nom, catégorie ou niveau de pureté avec filtrage avancé.',
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Rechercher des peptides | BioCycle Peptides',
    description: 'Recherchez des peptides par nom, catégorie ou niveau de pureté.',
    url: 'https://biocyclepeptides.com/search',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ma médiathèque',
  description: 'Accédez à votre bibliothèque de contenu personnelle sur BioCycle Peptides. Vidéos, guides et ressources de recherche.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Ma médiathèque | BioCycle Peptides',
    description: 'Votre bibliothèque de contenu personnelle sur BioCycle Peptides.',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return children;
}

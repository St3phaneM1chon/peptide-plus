import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tutoriels vidéo',
  description: 'Visionnez des tutoriels vidéo sur la reconstitution, le stockage, le calcul de dosage et les meilleures pratiques de recherche sur les peptides.',
  openGraph: {
    title: 'Tutoriels vidéo | BioCycle Peptides',
    description: 'Tutoriels vidéo sur la reconstitution, le stockage et le dosage des peptides.',
    url: 'https://biocyclepeptides.com/videos',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function VideosLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Our History | BioCycle Peptides',
  description: 'The story of BioCycle Peptides — from founding in Montreal to becoming Canada\'s trusted research peptide supplier.',
  openGraph: {
    title: 'Our History | BioCycle Peptides',
    description: 'The story of BioCycle Peptides — from founding in Montreal to becoming Canada\'s trusted research peptide supplier.',
  },
};

export default function HistoireLayout({ children }: { children: React.ReactNode }) {
  return children;
}

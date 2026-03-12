import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notre équipe',
  description: 'Découvrez l\'équipe d\'experts derrière BioCycle Peptides, dédiée à livrer des peptides de recherche de haute pureté au Canada.',
  openGraph: {
    title: 'Notre équipe | BioCycle Peptides',
    description: 'L\'équipe d\'experts derrière BioCycle Peptides.',
    url: 'https://biocyclepeptides.com/a-propos/equipe',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function EquipeLayout({ children }: { children: React.ReactNode }) {
  return children;
}

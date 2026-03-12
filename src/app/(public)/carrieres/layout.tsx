import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Carrières',
  description: 'Rejoignez l\'équipe BioCycle Peptides. Explorez nos postes ouverts et découvrez notre culture d\'entreprise dédiée à la recherche sur les peptides.',
  openGraph: {
    title: 'Carrières | BioCycle Peptides',
    description: 'Rejoignez l\'équipe BioCycle Peptides. Postes ouverts et culture d\'entreprise.',
    url: 'https://biocyclepeptides.com/carrieres',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function CarrieresLayout({ children }: { children: React.ReactNode }) {
  return children;
}

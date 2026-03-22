import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Carrieres chez BioCycle Peptides | Rejoignez notre equipe',
  description: 'Rejoignez l\'équipe BioCycle Peptides. Explorez nos postes ouverts et découvrez notre culture d\'entreprise dédiée à la recherche sur les peptides.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/carrieres`,
  },
  openGraph: {
    title: 'Carrieres chez BioCycle Peptides | Rejoignez notre equipe',
    description: 'Rejoignez l\'équipe BioCycle Peptides. Postes ouverts et culture d\'entreprise.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/carrieres`,
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Carrieres chez BioCycle Peptides | Rejoignez notre equipe',
    description: 'Rejoignez l\'équipe BioCycle Peptides. Postes ouverts et culture d\'entreprise.',
  },
};

export default function CarrieresLayout({ children }: { children: React.ReactNode }) {
  return children;
}

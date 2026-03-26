import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Carrieres chez Koraline | Rejoignez notre equipe',
  description: 'Rejoignez l\'équipe Koraline. Explorez nos postes ouverts et découvrez notre culture d\'entreprise dédiée à la recherche sur les peptides.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/carrieres`,
  },
  openGraph: {
    title: 'Carrieres chez Koraline | Rejoignez notre equipe',
    description: 'Rejoignez l\'équipe Koraline. Postes ouverts et culture d\'entreprise.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/carrieres`,
    siteName: 'Koraline',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Carrieres chez Koraline | Rejoignez notre equipe',
    description: 'Rejoignez l\'équipe Koraline. Postes ouverts et culture d\'entreprise.',
  },
};

export default function CarrieresLayout({ children }: { children: React.ReactNode }) {
  return children;
}

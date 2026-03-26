import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notre équipe | Koraline',
  description: 'Rencontrez l\'équipe multidisciplinaire de Koraline : scientifiques, logisticiens et experts dédiés à fournir des peptides de recherche de qualité.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/a-propos/equipe`,
  },
  openGraph: {
    title: 'Notre équipe | Koraline',
    description: 'Rencontrez l\'équipe multidisciplinaire de Koraline : scientifiques, logisticiens et experts dédiés à fournir des peptides de recherche de qualité.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/a-propos/equipe`,
    siteName: 'Koraline',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Notre équipe | Koraline',
    description: 'Rencontrez l\'équipe multidisciplinaire de Koraline : scientifiques, logisticiens et experts dédiés à fournir des peptides de recherche de qualité.',
  },
};

export default function EquipeLayout({ children }: { children: React.ReactNode }) {
  return children;
}

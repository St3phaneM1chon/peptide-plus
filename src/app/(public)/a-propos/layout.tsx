export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'À propos de BioCycle Peptides | BioCycle Peptides',
  description: 'Source canadienne de confiance pour les peptides de recherche de haute pureté. Fondée à Montréal, BioCycle Peptides livre des composés testés par des tiers avec documentation COA complète.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/a-propos`,
  },
  openGraph: {
    title: 'À propos de BioCycle Peptides | BioCycle Peptides',
    description: 'Source canadienne de confiance pour les peptides de recherche de haute pureté. Fondée à Montréal.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/a-propos`,
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'À propos de BioCycle Peptides | BioCycle Peptides',
    description: 'Source canadienne de confiance pour les peptides de recherche de haute pureté. Fondée à Montréal.',
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}

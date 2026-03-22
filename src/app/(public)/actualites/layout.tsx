import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Actualités | BioCycle Peptides',
  description: 'Restez informé des dernières nouvelles, lancements de produits et mises à jour de recherche de BioCycle Peptides au Canada.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/actualites`,
  },
  openGraph: {
    title: 'Actualités | BioCycle Peptides',
    description: 'Restez informé des dernières nouvelles, lancements de produits et mises à jour de recherche de BioCycle Peptides au Canada.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/actualites`,
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Actualités | BioCycle Peptides',
    description: 'Restez informé des dernières nouvelles, lancements de produits et mises à jour de recherche de BioCycle Peptides.',
  },
};

export default function ActualitesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

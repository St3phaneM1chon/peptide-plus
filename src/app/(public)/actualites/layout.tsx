import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Actualités | Koraline',
  description: 'Restez informé des dernières nouvelles, lancements de produits et mises à jour de recherche de Koraline au Canada.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/actualites`,
  },
  openGraph: {
    title: 'Actualités | Koraline',
    description: 'Restez informé des dernières nouvelles, lancements de produits et mises à jour de recherche de Koraline au Canada.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/actualites`,
    siteName: 'Koraline',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Actualités | Koraline',
    description: 'Restez informé des dernières nouvelles, lancements de produits et mises à jour de recherche de Koraline.',
  },
};

export default function ActualitesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

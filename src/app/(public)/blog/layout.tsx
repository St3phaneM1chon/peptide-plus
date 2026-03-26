import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blogue et articles de recherche',
  description: 'Articles scientifiques, guides sur les peptides et résultats de recherche de Koraline. Restez informé des dernières avancées.',
  openGraph: {
    title: 'Blogue et articles de recherche | Koraline',
    description: 'Articles scientifiques, guides sur les peptides et résultats de recherche.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/blog`,
    siteName: 'Koraline',
    type: 'website',
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}

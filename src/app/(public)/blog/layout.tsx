import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blogue et articles de recherche',
  description: 'Articles scientifiques, guides sur les peptides et résultats de recherche de BioCycle Peptides. Restez informé des dernières avancées.',
  openGraph: {
    title: 'Blogue et articles de recherche | BioCycle Peptides',
    description: 'Articles scientifiques, guides sur les peptides et résultats de recherche.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/blog`,
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}

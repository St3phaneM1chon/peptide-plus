import type { Metadata } from 'next';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';

export const metadata: Metadata = {
  title: 'Comparer les peptides',
  description: `Comparaison côte à côte des peptides de recherche ${siteName}. Comparez pureté, prix, options et spécifications.`,
  robots: { index: false, follow: true },
  openGraph: {
    title: `Comparer les peptides | ${siteName}`,
    description: `Comparaison côte à côte des peptides de recherche ${siteName}.`,
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/compare`,
    siteName,
    type: 'website',
  },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}

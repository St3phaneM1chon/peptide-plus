import type { Metadata } from 'next';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';

export const metadata: Metadata = {
  title: 'Comparer les produits',
  description: `Comparaison côte à côte des produits ${siteName}. Comparez caractéristiques, prix, options et spécifications.`,
  robots: { index: false, follow: true },
  openGraph: {
    title: `Comparer les produits | ${siteName}`,
    description: `Comparaison côte à côte des produits ${siteName}.`,
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/compare`,
    siteName,
    type: 'website',
  },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}

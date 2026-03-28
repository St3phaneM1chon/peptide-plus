import type { Metadata } from 'next';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';

export const metadata: Metadata = {
  title: 'Ensembles et kits de produits',
  description: `Économisez avec les ensembles de recherche préconfigurés ${siteName}. Tout ce dont vous avez besoin à prix réduit.`,
  openGraph: {
    title: `Ensembles et kits de produits | ${siteName}`,
    description: 'Ensembles de recherche préconfigurés à prix réduit.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/bundles`,
    siteName,
    type: 'website',
  },
};

export default function BundlesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

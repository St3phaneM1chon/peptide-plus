import type { Metadata } from 'next';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';

export const metadata: Metadata = {
  title: 'Rechercher des produits',
  description: `Recherchez dans le catalogue ${siteName}. Trouvez des produits par nom, catégorie ou caractéristiques avec filtrage avancé.`,
  robots: { index: false, follow: true },
  openGraph: {
    title: `Rechercher des produits | ${siteName}`,
    description: 'Recherchez des produits par nom, catégorie ou caractéristiques.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/search`,
    siteName,
    type: 'website',
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}

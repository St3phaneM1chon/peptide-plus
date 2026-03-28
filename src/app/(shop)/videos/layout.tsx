import type { Metadata } from 'next';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';

export const metadata: Metadata = {
  title: 'Tutoriels vidéo',
  description: 'Visionnez des tutoriels vidéo sur la reconstitution, le stockage, le calcul de dosage et les meilleures pratiques de recherche.',
  openGraph: {
    title: `Tutoriels vidéo | ${siteName}`,
    description: 'Tutoriels vidéo sur la reconstitution, le stockage et le dosage des produits.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/videos`,
    siteName,
    type: 'website',
  },
};

export default function VideosLayout({ children }: { children: React.ReactNode }) {
  return children;
}

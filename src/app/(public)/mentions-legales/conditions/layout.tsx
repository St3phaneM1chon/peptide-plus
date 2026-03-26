import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conditions générales d\'utilisation | Koraline',
  description: 'Consultez les conditions générales régissant l\'utilisation du site web et l\'achat de peptides de recherche Koraline.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/mentions-legales/conditions`,
  },
  openGraph: {
    title: 'Conditions générales d\'utilisation | Koraline',
    description: 'Conditions générales régissant l\'utilisation du site web et l\'achat de peptides de recherche Koraline.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/mentions-legales/conditions`,
    siteName: 'Koraline',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Conditions générales d\'utilisation | Koraline',
    description: 'Conditions générales régissant l\'utilisation du site web et l\'achat de peptides de recherche Koraline.',
  },
};

export default function ConditionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

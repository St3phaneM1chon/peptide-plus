import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de cookies | BioCycle Peptides',
  description: 'Comprenez comment BioCycle Peptides utilise les cookies et technologies de suivi sur notre site. Gérez vos préférences facilement.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/mentions-legales/cookies`,
  },
  openGraph: {
    title: 'Politique de cookies | BioCycle Peptides',
    description: 'Comprenez comment BioCycle Peptides utilise les cookies et technologies de suivi sur notre site. Gérez vos préférences facilement.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/mentions-legales/cookies`,
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Politique de cookies | BioCycle Peptides',
    description: 'Comprenez comment BioCycle Peptides utilise les cookies et technologies de suivi sur notre site.',
  },
};

export default function CookiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de cookies',
  description: 'Comprenez comment BioCycle Peptides utilise les cookies et les technologies de suivi similaires sur notre site web.',
  openGraph: {
    title: 'Politique de cookies | BioCycle Peptides',
    description: 'Comment BioCycle Peptides utilise les cookies et technologies de suivi.',
    url: 'https://biocyclepeptides.com/mentions-legales/cookies',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function CookiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

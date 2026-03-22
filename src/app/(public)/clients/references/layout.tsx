import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Références clients | BioCycle Peptides',
  description: 'Découvrez les laboratoires et institutions de 12 pays qui font confiance à BioCycle Peptides pour leurs peptides de recherche.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/clients/references`,
  },
  openGraph: {
    title: 'Références clients | BioCycle Peptides',
    description: 'Découvrez les laboratoires et institutions de 12 pays qui font confiance à BioCycle Peptides pour leurs peptides de recherche.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/clients/references`,
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Références clients | BioCycle Peptides',
    description: 'Découvrez les laboratoires et institutions de 12 pays qui font confiance à BioCycle Peptides pour leurs peptides de recherche.',
  },
};

export default function ReferencesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

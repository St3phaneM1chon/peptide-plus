import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nos clients | BioCycle Peptides',
  description: 'Découvrez les entreprises et chercheurs qui font confiance à BioCycle Peptides pour leurs peptides de recherche de haute pureté.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/clients`,
  },
  openGraph: {
    title: 'Nos clients | BioCycle Peptides',
    description: 'Découvrez les entreprises et chercheurs qui font confiance à BioCycle Peptides pour leurs peptides de recherche.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/clients`,
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nos clients | BioCycle Peptides',
    description: 'Découvrez les entreprises et chercheurs qui font confiance à BioCycle Peptides pour leurs peptides de recherche.',
  },
};

export default function ClientsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

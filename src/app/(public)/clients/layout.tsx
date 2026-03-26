import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nos clients | Koraline',
  description: 'Découvrez les entreprises et chercheurs qui font confiance à Koraline pour leurs peptides de recherche de haute pureté.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/clients`,
  },
  openGraph: {
    title: 'Nos clients | Koraline',
    description: 'Découvrez les entreprises et chercheurs qui font confiance à Koraline pour leurs peptides de recherche.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/clients`,
    siteName: 'Koraline',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nos clients | Koraline',
    description: 'Découvrez les entreprises et chercheurs qui font confiance à Koraline pour leurs peptides de recherche.',
  },
};

export default function ClientsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

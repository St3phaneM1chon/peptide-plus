import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Témoignages clients | Koraline',
  description: 'Lisez les témoignages de chercheurs et laboratoires sur leur expérience avec les peptides de recherche Koraline.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/clients/temoignages`,
  },
  openGraph: {
    title: 'Témoignages clients | Koraline',
    description: 'Lisez les témoignages de chercheurs et laboratoires sur leur expérience avec les peptides de recherche Koraline.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/clients/temoignages`,
    siteName: 'Koraline',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Témoignages clients | Koraline',
    description: 'Lisez les témoignages de chercheurs et laboratoires sur leur expérience avec les peptides de recherche Koraline.',
  },
};

export default function TestimonialsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

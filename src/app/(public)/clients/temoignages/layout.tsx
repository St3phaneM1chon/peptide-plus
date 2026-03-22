import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Témoignages clients | BioCycle Peptides',
  description: 'Lisez les témoignages de chercheurs et laboratoires sur leur expérience avec les peptides de recherche BioCycle Peptides.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/clients/temoignages`,
  },
  openGraph: {
    title: 'Témoignages clients | BioCycle Peptides',
    description: 'Lisez les témoignages de chercheurs et laboratoires sur leur expérience avec les peptides de recherche BioCycle Peptides.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/clients/temoignages`,
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Témoignages clients | BioCycle Peptides',
    description: 'Lisez les témoignages de chercheurs et laboratoires sur leur expérience avec les peptides de recherche BioCycle Peptides.',
  },
};

export default function TestimonialsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

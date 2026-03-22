import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contactez-nous | BioCycle Peptides',
  description: 'Communiquez avec BioCycle Peptides, fournisseur canadien de peptides de recherche basé à Montréal. Support bilingue disponible.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/contact`,
  },
  openGraph: {
    title: 'Contactez-nous | BioCycle Peptides',
    description: 'Communiquez avec BioCycle Peptides, fournisseur canadien de peptides de recherche basé à Montréal. Support bilingue disponible.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/contact`,
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contactez-nous | BioCycle Peptides',
    description: 'Communiquez avec BioCycle Peptides, fournisseur canadien de peptides de recherche basé à Montréal. Support bilingue disponible.',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}

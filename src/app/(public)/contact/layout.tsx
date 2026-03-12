import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contactez-nous',
  description: 'Communiquez avec BioCycle Peptides. Fournisseur canadien de peptides de recherche basé à Montréal. Support bilingue disponible.',
  openGraph: {
    title: 'Contactez-nous | BioCycle Peptides',
    description: 'Communiquez avec BioCycle Peptides. Support bilingue disponible.',
    url: 'https://biocyclepeptides.com/contact',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}

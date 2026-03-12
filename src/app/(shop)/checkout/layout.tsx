import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Paiement',
  description: 'Complétez votre commande BioCycle Peptides de façon sécurisée.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Paiement | BioCycle Peptides',
    description: 'Complétez votre commande BioCycle Peptides de façon sécurisée.',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}

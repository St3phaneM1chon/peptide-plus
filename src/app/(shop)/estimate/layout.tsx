import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Soumission',
  description: 'Consultez votre soumission BioCycle Peptides. Détails des produits, prix et conditions.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Soumission | BioCycle Peptides',
    description: 'Consultez votre soumission BioCycle Peptides.',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function EstimateLayout({ children }: { children: React.ReactNode }) {
  return children;
}

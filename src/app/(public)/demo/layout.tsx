import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Demander une démonstration | BioCycle Peptides',
  description: 'Demandez une démonstration personnalisée des produits et services BioCycle Peptides pour vos besoins en peptides de recherche.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/demo`,
  },
  openGraph: {
    title: 'Demander une démonstration | BioCycle Peptides',
    description: 'Demandez une démonstration personnalisée des produits et services BioCycle Peptides pour vos besoins en peptides de recherche.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/demo`,
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Demander une démonstration | BioCycle Peptides',
    description: 'Demandez une démonstration personnalisée des produits et services BioCycle Peptides pour vos besoins en peptides de recherche.',
  },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}

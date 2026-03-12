import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Programme de récompenses',
  description: 'Accumulez des points à chaque achat et échangez-les contre des rabais. Rejoignez le programme de fidélité BioCycle Peptides.',
  openGraph: {
    title: 'Programme de récompenses | BioCycle Peptides',
    description: 'Accumulez des points et échangez-les contre des rabais sur les peptides de recherche.',
    url: 'https://biocyclepeptides.com/rewards',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function RewardsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

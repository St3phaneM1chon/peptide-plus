import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Suivre une commande',
  description: 'Suivez le statut de votre commande BioCycle Peptides et les détails d\'expédition.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Suivre une commande | BioCycle Peptides',
    description: 'Suivez le statut de votre commande et les détails d\'expédition.',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function TrackOrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}

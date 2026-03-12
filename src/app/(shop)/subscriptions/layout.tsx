import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Abonnements peptides',
  description: 'Configurez des livraisons automatiques de peptides et économisez jusqu\'à 20 % par commande. Pause ou annulation en tout temps.',
  openGraph: {
    title: 'Abonnements peptides | BioCycle Peptides',
    description: 'Livraisons automatiques de peptides avec économies jusqu\'à 20 %. Pause ou annulation en tout temps.',
    url: 'https://biocyclepeptides.com/subscriptions',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function SubscriptionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

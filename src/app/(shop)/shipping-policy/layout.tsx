import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique d\'expédition',
  description: 'Politique d\'expédition BioCycle Peptides : livraison pancanadienne et internationale, emballage réfrigéré, délais de traitement et suivi de commande.',
  openGraph: {
    title: 'Politique d\'expédition | BioCycle Peptides',
    description: 'Livraison pancanadienne et internationale, emballage réfrigéré et suivi de commande.',
    url: 'https://biocyclepeptides.com/shipping-policy',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function ShippingPolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}

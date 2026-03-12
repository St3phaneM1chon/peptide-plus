import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cartes-cadeaux',
  description: 'Offrez le cadeau de la recherche. Achetez une carte-cadeau BioCycle Peptides de 25 $ à 1 000 $ — valide pour tout produit sur notre site.',
  openGraph: {
    title: 'Cartes-cadeaux | BioCycle Peptides',
    description: 'Cartes-cadeaux BioCycle Peptides de 25 $ à 1 000 $.',
    url: 'https://biocyclepeptides.com/gift-cards',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function GiftCardsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

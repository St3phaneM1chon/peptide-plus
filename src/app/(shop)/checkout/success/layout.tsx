import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Commande confirmée',
  description: 'Votre commande BioCycle Peptides a été confirmée. Merci pour votre achat.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Commande confirmée | BioCycle Peptides',
    description: 'Votre commande BioCycle Peptides a été confirmée.',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function CheckoutSuccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Orders | BioCycle Peptides',
  description: 'View your order history, track shipments, and manage returns for your BioCycle Peptides purchases.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'My Orders | BioCycle Peptides',
    description: 'View your order history, track shipments, and manage returns for your BioCycle Peptides purchases.',
  },
};

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return children;
}

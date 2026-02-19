import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Order Confirmed',
  description: 'Your BioCycle Peptides order has been confirmed. Thank you for your purchase.',
  robots: { index: false, follow: false },
};

export default function CheckoutSuccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}

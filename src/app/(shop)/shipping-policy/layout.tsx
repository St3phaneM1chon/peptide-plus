import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shipping Policy',
  description: 'BioCycle Peptides shipping policy: Canada-wide and international delivery options, cold-chain packaging, processing times, and order tracking.',
};

export default function ShippingPolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}

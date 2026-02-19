import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'View BioCycle Peptides pricing plans. Competitive rates on premium research peptides with volume discounts and subscription options.',
};

export default function TarifsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

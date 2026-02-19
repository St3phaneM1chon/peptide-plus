import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Loyalty Rewards Program',
  description: 'Earn points on every purchase and redeem them for discounts. Join the BioCycle Peptides loyalty program and save on research peptides.',
};

export default function RewardsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

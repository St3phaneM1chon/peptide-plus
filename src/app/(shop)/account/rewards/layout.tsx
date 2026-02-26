import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Rewards | BioCycle Peptides',
  description: 'View your loyalty points balance, earned rewards, and redeem discounts on research peptides.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'My Rewards | BioCycle Peptides',
    description: 'View your loyalty points balance, earned rewards, and redeem discounts on research peptides.',
  },
};

export default function RewardsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

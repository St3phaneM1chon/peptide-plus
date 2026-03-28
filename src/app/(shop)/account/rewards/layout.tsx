import type { Metadata } from 'next';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';

export const metadata: Metadata = {
  title: `My Rewards | ${siteName}`,
  description: 'View your loyalty points balance, earned rewards, and redeem discounts on your purchases.',
  robots: { index: false, follow: false },
  openGraph: {
    title: `My Rewards | ${siteName}`,
    description: 'View your loyalty points balance, earned rewards, and redeem discounts on your purchases.',
  },
};

export default function RewardsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

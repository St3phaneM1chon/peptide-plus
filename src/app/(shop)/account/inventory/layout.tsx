import type { Metadata } from 'next';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';

export const metadata: Metadata = {
  title: `My Inventory | ${siteName}`,
  description: 'Track your current product inventory, manage stock levels, and view usage history.',
  robots: { index: false, follow: false },
  openGraph: {
    title: `My Inventory | ${siteName}`,
    description: 'Track your current product inventory, manage stock levels, and view usage history.',
  },
};

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}

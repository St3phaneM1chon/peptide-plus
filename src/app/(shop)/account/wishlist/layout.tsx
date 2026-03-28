import type { Metadata } from 'next';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';

export const metadata: Metadata = {
  title: `My Wishlist | ${siteName}`,
  description: 'View and manage your saved wishlist items for future purchases.',
  robots: { index: false, follow: false },
  openGraph: {
    title: `My Wishlist | ${siteName}`,
    description: 'View and manage your saved wishlist items for future purchases.',
  },
};

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}

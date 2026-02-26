import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Wishlist | BioCycle Peptides',
  description: 'View and manage your saved research peptides wishlist for future purchases.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'My Wishlist | BioCycle Peptides',
    description: 'View and manage your saved research peptides wishlist for future purchases.',
  },
};

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}

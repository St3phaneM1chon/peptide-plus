import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Inventory | BioCycle Peptides',
  description: 'Track your current peptide inventory, manage stock levels, and view usage history.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'My Inventory | BioCycle Peptides',
    description: 'Track your current peptide inventory, manage stock levels, and view usage history.',
  },
};

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}

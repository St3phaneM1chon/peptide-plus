import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Track Order',
  description: 'Track your BioCycle Peptides order status and shipping details.',
  robots: { index: false, follow: false },
};

export default function TrackOrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}

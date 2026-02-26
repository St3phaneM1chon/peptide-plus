import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Referrals | BioCycle Peptides',
  description: 'Track your referrals, earn rewards, and share BioCycle Peptides with fellow researchers.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'My Referrals | BioCycle Peptides',
    description: 'Track your referrals, earn rewards, and share BioCycle Peptides with fellow researchers.',
  },
};

export default function ReferralsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

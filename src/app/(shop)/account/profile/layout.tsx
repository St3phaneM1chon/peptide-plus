import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Profile | BioCycle Peptides',
  description: 'Update your personal information, contact details, and account preferences.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'My Profile | BioCycle Peptides',
    description: 'Update your personal information, contact details, and account preferences.',
  },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}

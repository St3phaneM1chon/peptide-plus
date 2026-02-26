import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Out | BioCycle Peptides',
  description: 'You have been signed out of your BioCycle Peptides account.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Sign Out | BioCycle Peptides',
    description: 'You have been signed out of your BioCycle Peptides account.',
  },
};

export default function SignoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}

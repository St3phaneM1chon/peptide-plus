import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Authentication | BioCycle Peptides',
  description: 'Sign in or create your BioCycle Peptides account.',
  robots: { index: false, follow: false },
};

export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  return children;
}

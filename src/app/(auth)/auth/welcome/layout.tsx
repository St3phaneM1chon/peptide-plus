import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Welcome to BioCycle Peptides',
  description: 'Welcome! Your BioCycle Peptides account is ready. Start exploring our catalogue of high-purity research peptides.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Welcome to BioCycle Peptides',
    description: 'Welcome! Your BioCycle Peptides account is ready.',
  },
};

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}

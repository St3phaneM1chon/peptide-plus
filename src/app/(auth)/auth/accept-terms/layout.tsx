import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Accept Terms of Service | BioCycle Peptides',
  description: 'Review and accept the BioCycle Peptides Terms of Service and Privacy Policy to continue.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Accept Terms of Service | BioCycle Peptides',
    description: 'Review and accept the BioCycle Peptides Terms of Service and Privacy Policy to continue.',
  },
};

export default function AcceptTermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

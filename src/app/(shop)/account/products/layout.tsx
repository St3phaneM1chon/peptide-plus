import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Products | BioCycle Peptides',
  description: 'View and manage the research peptide products associated with your account.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'My Products | BioCycle Peptides',
    description: 'View and manage the research peptide products associated with your account.',
  },
};

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

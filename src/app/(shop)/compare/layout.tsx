import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Compare Peptides',
  description: 'Side-by-side comparison of BioCycle Peptides research compounds. Compare purity, price, formats, and specifications to find the right peptide.',
  robots: { index: false, follow: true },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Peptide Bundles & Kits',
  description: 'Save more with BioCycle Peptides pre-configured research bundles. Get everything you need at a discounted price.',
};

export default function BundlesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

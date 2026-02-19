import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search Research Peptides',
  description: 'Search the BioCycle Peptides catalogue. Find research peptides by name, category, or purity level with advanced filtering.',
  robots: { index: false, follow: true },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}

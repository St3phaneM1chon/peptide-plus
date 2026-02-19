import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blog & Research Articles',
  description: 'Research insights, peptide guides, and scientific articles from BioCycle Peptides. Stay informed on the latest in peptide science.',
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}

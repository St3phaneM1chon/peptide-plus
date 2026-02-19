import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Research Guides',
  description: 'Access comprehensive research guides on peptide handling, storage, reconstitution, and best practices from BioCycle Peptides.',
};

export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

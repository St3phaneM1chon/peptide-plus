import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Video Tutorials & Research Guides',
  description: 'Watch step-by-step video tutorials on peptide reconstitution, storage, dosage calculation, and research best practices from BioCycle Peptides.',
};

export default function VideosLayout({ children }: { children: React.ReactNode }) {
  return children;
}

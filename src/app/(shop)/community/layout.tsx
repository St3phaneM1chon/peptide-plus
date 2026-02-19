import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Community Forum',
  description: 'Connect with fellow researchers, share peptide experiences, ask questions, and learn from the BioCycle Peptides community.',
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children;
}

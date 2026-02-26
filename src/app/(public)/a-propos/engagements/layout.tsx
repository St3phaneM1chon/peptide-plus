import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Our Commitments | BioCycle Peptides',
  description: 'BioCycle Peptides commitments to quality, purity, and responsible research peptide distribution in Canada.',
  openGraph: {
    title: 'Our Commitments | BioCycle Peptides',
    description: 'BioCycle Peptides commitments to quality, purity, and responsible research peptide distribution in Canada.',
  },
};

export default function EngagementsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

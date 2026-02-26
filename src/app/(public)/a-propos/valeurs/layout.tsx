import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Our Values | BioCycle Peptides',
  description: 'The core values that drive BioCycle Peptides: scientific integrity, quality, transparency, and commitment to the research community.',
  openGraph: {
    title: 'Our Values | BioCycle Peptides',
    description: 'The core values that drive BioCycle Peptides: scientific integrity, quality, transparency, and commitment to the research community.',
  },
};

export default function ValeursLayout({ children }: { children: React.ReactNode }) {
  return children;
}

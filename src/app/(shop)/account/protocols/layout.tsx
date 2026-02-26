import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Research Protocols | BioCycle Peptides',
  description: 'Manage your saved research protocols and peptide usage documentation.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'My Research Protocols | BioCycle Peptides',
    description: 'Manage your saved research protocols and peptide usage documentation.',
  },
};

export default function ProtocolsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Our Team | BioCycle Peptides',
  description: 'Meet the expert team behind BioCycle Peptides, dedicated to delivering high-purity research peptides across Canada.',
  openGraph: {
    title: 'Our Team | BioCycle Peptides',
    description: 'Meet the expert team behind BioCycle Peptides, dedicated to delivering high-purity research peptides across Canada.',
  },
};

export default function EquipeLayout({ children }: { children: React.ReactNode }) {
  return children;
}

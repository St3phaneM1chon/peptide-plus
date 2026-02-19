import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Careers',
  description: 'Join the BioCycle Peptides team. Explore open positions and discover our company culture dedicated to advancing peptide research.',
};

export default function CarrieresLayout({ children }: { children: React.ReactNode }) {
  return children;
}

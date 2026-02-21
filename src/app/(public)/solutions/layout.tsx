import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Solutions',
  description: 'Tailored peptide solutions for businesses, individuals, and partners across multiple industries.',
};

export default function SolutionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

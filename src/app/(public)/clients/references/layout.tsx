import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Client References',
  description: 'Discover the 500+ companies across 8 industries and 12 countries that trust BioCycle Peptides.',
};

export default function ReferencesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

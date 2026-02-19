import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'News',
  description: 'Stay up to date with the latest news, product launches, and research updates from BioCycle Peptides.',
};

export default function ActualitesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

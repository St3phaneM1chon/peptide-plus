import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About BioCycle Peptides',
  description: "Canada's trusted source for high-purity research peptides. Founded in Montreal, BioCycle Peptides delivers third-party tested compounds with full COA documentation.",
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}

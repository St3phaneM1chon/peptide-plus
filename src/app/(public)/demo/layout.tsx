import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Request Demo',
  description: 'Request a personalized demo of BioCycle Peptides products and services for your research needs.',
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}

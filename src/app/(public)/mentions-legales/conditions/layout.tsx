import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'Read the terms and conditions governing the use of BioCycle Peptides website and services.',
};

export default function ConditionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

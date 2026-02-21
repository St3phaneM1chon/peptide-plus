import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Accessibility | Peptide Plus+',
  description: 'Our commitment to making our platform accessible to everyone.',
};

export default function AccessibilityLayout({ children }: { children: React.ReactNode }) {
  return children;
}

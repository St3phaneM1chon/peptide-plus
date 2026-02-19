import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Learn how BioCycle Peptides collects, uses, and protects your personal information.',
};

export default function ConfidentialiteLayout({ children }: { children: React.ReactNode }) {
  return children;
}

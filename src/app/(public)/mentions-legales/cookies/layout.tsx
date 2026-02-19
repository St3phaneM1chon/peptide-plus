import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'Understand how BioCycle Peptides uses cookies and similar tracking technologies on our website.',
};

export default function CookiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

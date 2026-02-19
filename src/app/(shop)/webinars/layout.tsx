import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Webinars',
  description: 'Join BioCycle Peptides webinars to learn about peptide research, protocols, and best practices from industry experts.',
};

export default function WebinarsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

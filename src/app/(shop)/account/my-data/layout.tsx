import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Data | BioCycle Peptides',
  description: 'View and manage your personal data stored by BioCycle Peptides. Download or delete your data in compliance with privacy regulations.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'My Data | BioCycle Peptides',
    description: 'View and manage your personal data stored by BioCycle Peptides.',
  },
};

export default function MyDataLayout({ children }: { children: React.ReactNode }) {
  return children;
}

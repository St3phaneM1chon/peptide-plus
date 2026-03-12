import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security & Compliance',
  description: 'Discover how BioCycle Peptides protects your data and ensures platform security. Encryption, authentication, and compliance.',
  openGraph: {
    title: 'Security | BioCycle Peptides',
    description: 'How BioCycle Peptides protects your data and ensures platform security.',
    url: 'https://biocyclepeptides.com/securite',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return children;
}

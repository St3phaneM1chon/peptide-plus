import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security & Compliance',
  description: 'Discover how Koraline protects your data and ensures platform security. Encryption, authentication, and compliance.',
  openGraph: {
    title: 'Security | Koraline',
    description: 'How Koraline protects your data and ensures platform security.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/securite`,
    siteName: 'Koraline',
    type: 'website',
  },
};

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  return children;
}

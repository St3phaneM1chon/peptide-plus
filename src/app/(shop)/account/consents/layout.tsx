import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mes consentements',
  description: 'Gérez vos consentements et préférences de communication avec BioCycle Peptides.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Mes consentements | BioCycle Peptides',
    description: 'Gérez vos consentements et préférences de communication.',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function ConsentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Portail libre-service',
  description: 'Portail libre-service BioCycle Peptides. Gérez vos billets de support, consultez la base de connaissances et suivez vos commandes.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Portail libre-service | BioCycle Peptides',
    description: 'Portail libre-service BioCycle Peptides.',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}

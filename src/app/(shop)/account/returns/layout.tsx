import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Returns | BioCycle Peptides',
  description: 'Manage your return requests and track the status of refunds for BioCycle Peptides orders.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'My Returns | BioCycle Peptides',
    description: 'Manage your return requests and track the status of refunds for BioCycle Peptides orders.',
  },
};

export default function ReturnsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

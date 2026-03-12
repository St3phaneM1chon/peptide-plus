import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help Center',
  description: 'Find help and support for using the BioCycle Peptides platform. FAQ, guides, and technical assistance.',
  openGraph: {
    title: 'Help Center | BioCycle Peptides',
    description: 'Find help and support for using the BioCycle Peptides platform.',
    url: 'https://biocyclepeptides.com/aide',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}

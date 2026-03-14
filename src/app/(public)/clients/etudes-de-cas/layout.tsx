import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Études de cas',
  description: 'Découvrez comment nos clients utilisent les peptides de recherche BioCycle Peptides pour atteindre leurs objectifs scientifiques.',
  openGraph: {
    title: 'Études de cas | BioCycle Peptides',
    description: 'Découvrez comment nos clients utilisent les peptides BioCycle Peptides.',
    url: 'https://biocyclepeptides.com/clients/etudes-de-cas',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function CaseStudiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

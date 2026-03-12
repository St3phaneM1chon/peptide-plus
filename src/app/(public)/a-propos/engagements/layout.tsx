import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nos engagements',
  description: 'Les engagements de BioCycle Peptides envers la qualité, la pureté et la distribution responsable de peptides de recherche au Canada.',
  openGraph: {
    title: 'Nos engagements | BioCycle Peptides',
    description: 'Engagements envers la qualité, la pureté et la distribution responsable de peptides de recherche.',
    url: 'https://biocyclepeptides.com/a-propos/engagements',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function EngagementsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

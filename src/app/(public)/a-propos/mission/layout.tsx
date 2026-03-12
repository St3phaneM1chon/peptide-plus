import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notre mission',
  description: 'La mission de BioCycle Peptides : faire avancer la recherche scientifique en fournissant des peptides de haute pureté testés par des tiers aux chercheurs du Canada.',
  openGraph: {
    title: 'Notre mission | BioCycle Peptides',
    description: 'Faire avancer la recherche scientifique avec des peptides de haute pureté.',
    url: 'https://biocyclepeptides.com/a-propos/mission',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function MissionLayout({ children }: { children: React.ReactNode }) {
  return children;
}

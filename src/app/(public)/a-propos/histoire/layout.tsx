import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notre histoire',
  description: 'L\'histoire de BioCycle Peptides — de sa fondation à Montréal à devenir le fournisseur de peptides de recherche de confiance au Canada.',
  openGraph: {
    title: 'Notre histoire | BioCycle Peptides',
    description: 'L\'histoire de BioCycle Peptides, de sa fondation à Montréal.',
    url: 'https://biocyclepeptides.com/a-propos/histoire',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function HistoireLayout({ children }: { children: React.ReactNode }) {
  return children;
}

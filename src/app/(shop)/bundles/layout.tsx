import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ensembles et kits de peptides',
  description: 'Économisez avec les ensembles de recherche préconfigurés BioCycle Peptides. Tout ce dont vous avez besoin à prix réduit.',
  openGraph: {
    title: 'Ensembles et kits de peptides | BioCycle Peptides',
    description: 'Ensembles de recherche préconfigurés à prix réduit.',
    url: 'https://biocyclepeptides.com/bundles',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function BundlesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

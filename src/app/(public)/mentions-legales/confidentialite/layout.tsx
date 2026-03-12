import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Découvrez comment BioCycle Peptides collecte, utilise et protège vos renseignements personnels.',
  openGraph: {
    title: 'Politique de confidentialité | BioCycle Peptides',
    description: 'Comment BioCycle Peptides collecte, utilise et protège vos renseignements personnels.',
    url: 'https://biocyclepeptides.com/mentions-legales/confidentialite',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function ConfidentialiteLayout({ children }: { children: React.ReactNode }) {
  return children;
}

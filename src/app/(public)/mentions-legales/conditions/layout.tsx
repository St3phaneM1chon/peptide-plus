import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conditions générales',
  description: 'Consultez les conditions générales régissant l\'utilisation du site web et des services BioCycle Peptides.',
  openGraph: {
    title: 'Conditions générales | BioCycle Peptides',
    description: 'Conditions générales d\'utilisation du site web et des services BioCycle Peptides.',
    url: 'https://biocyclepeptides.com/mentions-legales/conditions',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function ConditionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

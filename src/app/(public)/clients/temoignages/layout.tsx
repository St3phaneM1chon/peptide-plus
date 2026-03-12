import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Témoignages',
  description: 'Lisez et visionnez les témoignages de nos clients sur leur expérience avec BioCycle Peptides.',
  openGraph: {
    title: 'Témoignages | BioCycle Peptides',
    description: 'Témoignages de nos clients sur leur expérience avec BioCycle Peptides.',
    url: 'https://biocyclepeptides.com/clients/temoignages',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function TestimonialsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

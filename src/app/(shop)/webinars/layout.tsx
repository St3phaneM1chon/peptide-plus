import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Webinaires',
  description: 'Participez aux webinaires BioCycle Peptides pour apprendre sur la recherche peptidique, les protocoles et les meilleures pratiques.',
  openGraph: {
    title: 'Webinaires | BioCycle Peptides',
    description: 'Webinaires sur la recherche peptidique, les protocoles et les meilleures pratiques.',
    url: 'https://biocyclepeptides.com/webinars',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

export default function WebinarsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

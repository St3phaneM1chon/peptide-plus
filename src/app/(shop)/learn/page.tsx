import { Metadata } from 'next';
import LearnPageClient from './LearnPageClient';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbSchema } from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Learning Center',
  description:
    'Your comprehensive resource for peptide research knowledge, guides, and scientific insights. Learn about reconstitution, storage, and peptide science.',
  alternates: {
    canonical: 'https://biocyclepeptides.com/learn',
  },
  openGraph: {
    title: 'Learning Center - BioCycle Peptides',
    description:
      'Your comprehensive resource for peptide research knowledge, guides, and scientific insights.',
    url: 'https://biocyclepeptides.com/learn',
    type: 'website',
    images: [
      {
        url: 'https://biocyclepeptides.com/api/og?title=Learning%20Center&type=page',
        width: 1200,
        height: 630,
        alt: 'Learning Center - BioCycle Peptides',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Learning Center - BioCycle Peptides',
    description:
      'Your comprehensive resource for peptide research knowledge, guides, and scientific insights.',
    images: ['https://biocyclepeptides.com/api/og?title=Learning%20Center&type=page'],
  },
};

export default function LearnPage() {
  const breadcrumbJsonLd = breadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Learning Center', url: '/learn' },
  ]);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <LearnPageClient />
    </>
  );
}

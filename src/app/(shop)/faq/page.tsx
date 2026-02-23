// BUG-060 FIX: Reduce ISR cache to 5 min for fresher data
export const revalidate = 300;

import { Metadata } from 'next';
import FaqPageClient from './FaqPageClient';
import { JsonLd } from '@/components/seo/JsonLd';
import { faqSchema, breadcrumbSchema } from '@/lib/structured-data';
import { prisma } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description:
    'Find answers to common questions about research peptides, ordering, shipping, reconstitution, and quality at BioCycle Peptides.',
  alternates: {
    canonical: 'https://biocyclepeptides.com/faq',
  },
  openGraph: {
    title: 'FAQ - BioCycle Peptides',
    description:
      'Find answers to common questions about research peptides, ordering, shipping, and quality.',
    url: 'https://biocyclepeptides.com/faq',
    type: 'website',
    images: [
      {
        url: 'https://biocyclepeptides.com/api/og?title=FAQ&type=page',
        width: 1200,
        height: 630,
        alt: 'FAQ - BioCycle Peptides',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FAQ - BioCycle Peptides',
    description:
      'Find answers to common questions about research peptides, ordering, shipping, and quality.',
    images: ['https://biocyclepeptides.com/api/og?title=FAQ&type=page'],
  },
};

async function getFaqs() {
  try {
    const faqs = await prisma.faq.findMany({
      where: { isPublished: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      select: { id: true, question: true, answer: true, category: true, sortOrder: true },
    });
    return faqs;
  } catch {
    return [];
  }
}

export default async function FaqPage() {
  const faqs = await getFaqs();

  // Group by category for the client component
  const byCategory: Record<string, { question: string; answer: string }[]> = {};
  for (const faq of faqs) {
    if (!byCategory[faq.category]) byCategory[faq.category] = [];
    byCategory[faq.category].push({ question: faq.question, answer: faq.answer });
  }

  const faqJsonLd = faqs.length > 0
    ? faqSchema(faqs.map((f) => ({ question: f.question, answer: f.answer })))
    : null;

  const breadcrumbJsonLd = breadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'FAQ', url: '/faq' },
  ]);

  return (
    <>
      {faqJsonLd && <JsonLd data={faqJsonLd} />}
      <JsonLd data={breadcrumbJsonLd} />
      <FaqPageClient initialByCategory={byCategory} />
    </>
  );
}

export const dynamic = 'force-dynamic';

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
  },
};

async function getFaqsForSchema() {
  try {
    const faqs = await prisma.faq.findMany({
      where: { isPublished: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      select: { question: true, answer: true },
    });
    return faqs;
  } catch {
    return [];
  }
}

export default async function FaqPage() {
  const faqs = await getFaqsForSchema();

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
      <FaqPageClient />
    </>
  );
}

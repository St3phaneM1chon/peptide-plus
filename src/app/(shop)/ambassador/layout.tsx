export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { JsonLd } from '@/components/seo/JsonLd';
import { faqSchema, breadcrumbSchema } from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Programme ambassadeur',
  description: 'Rejoignez le programme ambassadeur BioCycle Peptides et gagnez jusqu\'à 20 % de commission en partageant des peptides de recherche de confiance.',
  openGraph: {
    title: 'Programme ambassadeur | BioCycle Peptides',
    description: 'Gagnez jusqu\'à 20 % de commission en partageant des peptides de recherche de confiance.',
    url: 'https://biocyclepeptides.com/ambassador',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

// Ambassador FAQ items for JSON-LD structured data (matches client component)
const ambassadorFaqs = [
  { question: 'How do I get paid?', answer: 'Payments are made monthly via PayPal or bank transfer for earnings over $50.' },
  { question: 'Is there a minimum audience size?', answer: 'No minimum required! We welcome ambassadors of all sizes who are passionate about peptide research.' },
  { question: 'Can I promote on any platform?', answer: 'Yes! Blog, YouTube, Instagram, TikTok, email lists - wherever your audience is.' },
  { question: 'How long does the cookie last?', answer: 'Our tracking cookie lasts 30 days, so you get credit for sales within that window.' },
  { question: 'Do I need to be a customer first?', answer: 'While not required, it helps! Authentic recommendations from users perform best.' },
  { question: 'What marketing materials do you provide?', answer: 'We provide banners, product images, email templates, and social media content.' },
];

export default function AmbassadorLayout({ children }: { children: React.ReactNode }) {
  const faqJsonLd = faqSchema(ambassadorFaqs);
  const breadcrumbJsonLd = breadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Ambassador Program', url: '/ambassador' },
  ]);

  return (
    <>
      <JsonLd data={faqJsonLd} />
      <JsonLd data={breadcrumbJsonLd} />
      {children}
    </>
  );
}

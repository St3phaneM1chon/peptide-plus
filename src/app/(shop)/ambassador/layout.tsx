export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { JsonLd } from '@/components/seo/JsonLd';
import { faqSchema, breadcrumbSchema } from '@/lib/structured-data';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';

export const metadata: Metadata = {
  title: 'Programme ambassadeur',
  description: `Rejoignez le programme ambassadeur ${siteName} et gagnez jusqu'à 20 % de commission en partageant des produits de confiance.`,
  openGraph: {
    title: `Programme ambassadeur | ${siteName}`,
    description: 'Gagnez jusqu\'à 20 % de commission en partageant des produits de confiance.',
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip'}/ambassador`,
    siteName,
    type: 'website',
  },
};

// Ambassador FAQ items for JSON-LD structured data (matches client component)
const ambassadorFaqs = [
  { question: 'How do I get paid?', answer: 'Payments are made monthly via PayPal or bank transfer for earnings over $50.' },
  { question: 'Is there a minimum audience size?', answer: 'No minimum required! We welcome ambassadors of all sizes who are passionate about our products.' },
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

import { Metadata } from 'next';
import ShopPageClient from './ShopPageClient';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbSchema } from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Shop Research Peptides',
  description:
    'Browse our complete selection of premium research peptides. Lab-tested, 99%+ purity, fast Canadian shipping. BPC-157, TB-500, Semaglutide and more.',
  alternates: {
    canonical: 'https://biocyclepeptides.com/shop',
  },
  openGraph: {
    title: 'Shop Research Peptides - BioCycle Peptides',
    description:
      'Browse our complete selection of premium research peptides. Lab-tested, 99%+ purity.',
    url: 'https://biocyclepeptides.com/shop',
    type: 'website',
  },
};

export default function ShopPage() {
  const breadcrumbJsonLd = breadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Shop', url: '/shop' },
  ]);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <ShopPageClient />
    </>
  );
}

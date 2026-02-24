import { Metadata } from 'next';
import ShopPageClient from './ShopPageClient';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbSchema } from '@/lib/structured-data';
import { getServerLocale, createServerTranslator } from '@/i18n/server';

// FIX: BUG-040 - Use generateMetadata() for translated SEO metadata instead of hardcoded English
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createServerTranslator(locale);

  const title = `${t('shop.allProducts')} - ${t('shop.title')}`;
  const description = `${t('home.peptidesDesc')}. ${t('shop.labTested')}, ${t('shop.avgPurity')}, ${t('shop.fastShipping')}.`;
  const siteUrl = 'https://biocyclepeptides.com';
  const ogImageUrl = `${siteUrl}/api/og?title=${encodeURIComponent(t('shop.allProducts'))}&type=product`;

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/shop`,
    },
    openGraph: {
      title: `${title} - BioCycle Peptides`,
      description,
      url: `${siteUrl}/shop`,
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} - BioCycle Peptides`,
      description,
      images: [ogImageUrl],
    },
  };
}

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

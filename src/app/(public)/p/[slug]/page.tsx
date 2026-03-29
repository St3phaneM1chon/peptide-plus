/**
 * Catch-all public page route: /p/[slug]
 *
 * Loads a Page from the database by slug and renders it using the
 * appropriate template via PageRenderer.
 *
 * Templates: default, hero-content, sections, landing
 * ISR: revalidates every 5 minutes (300s)
 */

export const revalidate = 300;

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getContentPage } from '@/lib/content-pages';
import PageRenderer from '@/components/pages/PageRenderer';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getContentPage(slug);

  if (!page) return {};

  const title = page.metaTitle || page.title;
  const description = page.metaDescription || page.excerpt || '';
  const siteName = 'Attitudes VIP';
  const url = `https://attitudes.vip/p/${slug}`;

  return {
    title: `${title} | ${siteName}`,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName,
      type: 'website',
      ...(page.heroImageUrl ? { images: [{ url: page.heroImageUrl, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function CorporatePage({ params }: Props) {
  const { slug } = await params;
  const page = await getContentPage(slug);

  if (!page) {
    notFound();
  }

  return <PageRenderer page={page} />;
}

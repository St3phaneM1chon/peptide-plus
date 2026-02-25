import type { Metadata } from 'next';
import { getServerLocale, createServerTranslator } from '@/i18n/server';

// FIX F-029 (Communaute): Use generateMetadata for translated metadata instead of hardcoded English
// F086 FIX: Add Open Graph and Twitter Card meta tags for social sharing
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createServerTranslator(locale);

  const title = t('community.title') || 'Community Forum';
  const description = t('community.subtitle') || 'Connect with fellow researchers, share experiences, ask questions, and learn from the community.';
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://biocyclepeptides.com';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${siteUrl}/community`,
      siteName: 'BioCycle Peptides',
      type: 'website',
      locale,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children;
}

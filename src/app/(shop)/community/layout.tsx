import type { Metadata } from 'next';
import { getServerLocale, createServerTranslator } from '@/i18n/server';

// FIX F-029 (Communaute): Use generateMetadata for translated metadata instead of hardcoded English
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createServerTranslator(locale);

  return {
    title: t('community.title'),
    description: t('community.subtitle'),
  };
}

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children;
}

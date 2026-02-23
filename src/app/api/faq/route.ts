export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTranslations, DB_SOURCE_LOCALE } from '@/lib/translation';
import { defaultLocale } from '@/i18n/config';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') || defaultLocale;

    let faqs = await prisma.faq.findMany({
      where: { isPublished: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    // Apply translations
    if (locale !== DB_SOURCE_LOCALE) {
      faqs = await withTranslations(faqs, 'Faq', locale);
    }

    // Group by category
    const byCategory: Record<string, { question: string; answer: string }[]> = {};
    for (const faq of faqs) {
      if (!byCategory[faq.category]) byCategory[faq.category] = [];
      byCategory[faq.category].push({ question: faq.question, answer: faq.answer });
    }

    return NextResponse.json({ faqs, byCategory }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (error) {
    logger.error('FAQ API error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch FAQs' },
      { status: 500 }
    );
  }
}

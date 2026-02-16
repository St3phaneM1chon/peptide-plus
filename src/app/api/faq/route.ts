export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTranslations } from '@/lib/translation';
import { defaultLocale } from '@/i18n/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') || defaultLocale;

    let faqs = await prisma.faq.findMany({
      where: { isPublished: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    // Apply translations
    if (locale !== defaultLocale) {
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
    console.error('FAQ API error:', error);
    return NextResponse.json({ faqs: [], byCategory: {} });
  }
}

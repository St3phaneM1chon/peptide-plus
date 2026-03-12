export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { defaultLocale } from '@/i18n/config';

// GET - Slides actives (public, cache 60s)
// Accepts ?locale= param to filter translations (returns requested locale + default fallback)
export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const locale = request.nextUrl.searchParams.get('locale') || defaultLocale;

    const slides = await prisma.heroSlide.findMany({
      where: {
        isActive: true,
        OR: [
          { startDate: null, endDate: null },
          { startDate: { lte: now }, endDate: null },
          { startDate: null, endDate: { gte: now } },
          { startDate: { lte: now }, endDate: { gte: now } },
        ],
      },
      include: {
        translations: {
          where: { locale: { in: locale !== defaultLocale ? [locale, defaultLocale] : [defaultLocale] } },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(
      { slides },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error) {
    logger.error('Error fetching active hero slides', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

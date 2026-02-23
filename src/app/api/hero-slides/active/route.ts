export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// GET - Slides actives (public, cache 60s)
export async function GET() {
  try {
    const now = new Date();

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
      // FIX: FLAW-091 - TODO: Accept locale param and filter translations: where: { locale: { in: [locale, 'en'] } }
      include: { translations: true },
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

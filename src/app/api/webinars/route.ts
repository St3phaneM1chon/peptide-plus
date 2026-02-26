export const dynamic = 'force-dynamic';

/**
 * API - Webinars (public)
 * GET: Fetch all published webinars, ordered by scheduledAt desc
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTranslations, DB_SOURCE_LOCALE } from '@/lib/translation';
import { defaultLocale } from '@/i18n/config';
// FLAW-068 FIX: Use structured logger instead of console.error
import { logger } from '@/lib/logger';

// GET - List published webinars
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') || defaultLocale;

    // FLAW-068 FIX: Add take limit to prevent unbounded query
    // NOTE: FLAW-080 - Webinar.tags stored as string; JSON array migration deferred (low usage)
    let webinars = await prisma.webinar.findMany({
      where: {
        isPublished: true,
      },
      orderBy: {
        scheduledAt: 'desc',
      },
      take: 50,
    });

    // Apply translations
    if (locale !== DB_SOURCE_LOCALE) {
      webinars = await withTranslations(webinars, 'Webinar', locale);
    }

    return NextResponse.json({ webinars }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    logger.error('Error fetching webinars:', error);
    return NextResponse.json(
      { error: 'Error fetching webinars' },
      { status: 500 }
    );
  }
}

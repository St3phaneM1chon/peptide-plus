export const dynamic = 'force-dynamic';

/**
 * API - Webinars (public)
 * GET: Fetch all published webinars, ordered by scheduledAt desc
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTranslations } from '@/lib/translation';
import { defaultLocale } from '@/i18n/config';

// GET - List published webinars
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') || defaultLocale;

    let webinars = await prisma.webinar.findMany({
      where: {
        isPublished: true,
      },
      orderBy: {
        scheduledAt: 'desc',
      },
    });

    // Apply translations
    if (locale !== defaultLocale) {
      webinars = await withTranslations(webinars, 'Webinar', locale);
    }

    return NextResponse.json({ webinars }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('Error fetching webinars:', error);
    return NextResponse.json(
      { error: 'Error fetching webinars' },
      { status: 500 }
    );
  }
}

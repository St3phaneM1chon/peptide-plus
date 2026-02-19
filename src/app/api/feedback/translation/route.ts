export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { locale, rating, comment, page } = body;

    if (!locale || !rating || !page) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    if (rating !== 'good' && rating !== 'bad') {
      return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
    }

    // BE-SEC-03: Strip HTML from user-submitted text fields
    // BE-SEC-05: Enforce length limits
    const safeLocale = String(locale).replace(/<[^>]*>/g, '').slice(0, 10);
    const safePage = String(page).replace(/<[^>]*>/g, '').slice(0, 500);
    const safeComment = comment ? String(comment).replace(/<[^>]*>/g, '').slice(0, 1000) : undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    await prisma.translationFeedback.create({
      data: {
        locale: safeLocale,
        rating,
        comment: safeComment,
        page: safePage,
        userAgent: userAgent?.slice(0, 500),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TranslationFeedback] Error:', error);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }
}

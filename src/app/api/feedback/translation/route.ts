export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limit unauthenticated feedback endpoint - prevents abuse/spam
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/feedback/translation');
    if (!rl.success) {
      const res = NextResponse.json(
        { error: rl.error!.message },
        { status: 429 }
      );
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

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
    logger.error('[TranslationFeedback] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }
}

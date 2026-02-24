export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { logger } from '@/lib/logger';
import { stripHtml, stripControlChars } from '@/lib/sanitize';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const translationFeedbackSchema = z.object({
  locale: z.string().min(1).max(10),
  rating: z.enum(['good', 'bad']),
  comment: z.string().max(1000).optional(),
  page: z.string().min(1).max(500),
});

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

    // SECURITY: CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();

    // Validate with Zod
    const parsed = translationFeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { locale, rating, comment, page } = parsed.data;

    // BE-SEC-03: Strip HTML and control chars from user-submitted text fields
    const safeLocale = stripControlChars(stripHtml(locale));
    const safePage = stripControlChars(stripHtml(page));
    const safeComment = comment ? stripControlChars(stripHtml(comment)) : undefined;
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

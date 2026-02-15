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

    const userAgent = request.headers.get('user-agent') || undefined;

    await prisma.translationFeedback.create({
      data: {
        locale,
        rating,
        comment: comment ? String(comment).slice(0, 1000) : undefined,
        page: String(page).slice(0, 500),
        userAgent: userAgent?.slice(0, 500),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TranslationFeedback] Error:', error);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }
}

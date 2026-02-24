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

    const take = Math.min(Number(searchParams.get('limit') || 50), 100);
    const skip = Number(searchParams.get('offset') || 0);

    let posts = await prisma.blogPost.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: 'desc' },
      take,
      skip,
      select: {
        id: true, title: true, slug: true, excerpt: true, imageUrl: true,
        author: true, category: true, readTime: true, isFeatured: true,
        publishedAt: true, locale: true,
      },
    });

    // Apply translations
    if (locale !== DB_SOURCE_LOCALE) {
      posts = await withTranslations(posts, 'BlogPost', locale);
    }

    return NextResponse.json({ posts }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    logger.error('Blog API error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ posts: [] });
  }
}

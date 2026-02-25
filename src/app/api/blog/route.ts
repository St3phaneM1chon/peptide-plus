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

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10)), 200);
    const skip = (page - 1) * limit;

    const where = { isPublished: true };

    let [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, title: true, slug: true, excerpt: true, imageUrl: true,
          author: true, category: true, readTime: true, isFeatured: true,
          publishedAt: true, locale: true,
        },
      }),
      prisma.blogPost.count({ where }),
    ]);

    // Apply translations
    if (locale !== DB_SOURCE_LOCALE) {
      posts = await withTranslations(posts, 'BlogPost', locale);
    }

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({ data: posts, total, page, limit, totalPages }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    logger.error('Blog API error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to fetch blog posts', data: [], total: 0, page: 1, limit: 50, totalPages: 0 }, { status: 500 });
  }
}

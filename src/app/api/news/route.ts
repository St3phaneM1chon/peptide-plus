export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const articles = await prisma.newsArticle.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true, title: true, slug: true, excerpt: true, imageUrl: true,
        type: true, author: true, isFeatured: true, publishedAt: true, locale: true,
      },
    });
    return NextResponse.json({ articles }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    logger.error('News API error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ articles: [] });
  }
}

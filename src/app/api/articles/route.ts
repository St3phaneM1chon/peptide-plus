export const dynamic = 'force-dynamic';

/**
 * API - Articles (public)
 * GET: Fetch all published articles, with optional category filter and pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTranslations } from '@/lib/translation';
import { defaultLocale } from '@/i18n/config';

// GET - List published articles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') || defaultLocale;
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const offset = (page - 1) * limit;

    // Build where clause - only published articles
    const where: Record<string, unknown> = {
      isPublished: true,
    };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: [
          { publishedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: offset,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          imageUrl: true,
          author: true,
          category: true,
          tags: true,
          readTime: true,
          difficulty: true,
          isFeatured: true,
          isPublished: true,
          publishedAt: true,
          locale: true,
          metaTitle: true,
          metaDescription: true,
          translations: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.article.count({ where }),
    ]);

    // Apply translations for non-default locales
    let translatedArticles = articles;
    if (locale !== defaultLocale) {
      translatedArticles = await withTranslations(articles, 'Article', locale);
    }

    // Parse tags for frontend
    const enrichedArticles = translatedArticles.map(a => {
      let parsedTags: string[] = [];
      if (a.tags) {
        try {
          parsedTags = JSON.parse(a.tags);
        } catch {
          parsedTags = a.tags.split(',').map(t => t.trim());
        }
      }

      return {
        ...a,
        tags: parsedTags,
      };
    });

    return NextResponse.json({
      articles: enrichedArticles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json(
      { error: 'Error fetching articles' },
      { status: 500 }
    );
  }
}

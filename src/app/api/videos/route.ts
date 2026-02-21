export const dynamic = 'force-dynamic';

/**
 * API - Videos (public)
 * GET: Fetch all published videos, with optional category filter and pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTranslations, DB_SOURCE_LOCALE } from '@/lib/translation';
import { defaultLocale } from '@/i18n/config';

// GET - List published videos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') || defaultLocale;
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const offset = (page - 1) * limit;

    // Build where clause - only published videos
    const where: Record<string, unknown> = {
      isPublished: true,
    };

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { instructor: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'desc' },
        ],
        take: limit,
        skip: offset,
        include: {
          translations: true,
        },
      }),
      prisma.video.count({ where }),
    ]);

    // Apply translations for non-default locales
    let translatedVideos = videos;
    if (locale !== DB_SOURCE_LOCALE) {
      translatedVideos = await withTranslations(videos, 'Video', locale);
    }

    // Parse tags for frontend
    const enrichedVideos = translatedVideos.map(v => {
      let parsedTags: string[] = [];
      if (v.tags) {
        try {
          parsedTags = JSON.parse(v.tags);
        } catch {
          parsedTags = v.tags.split(',').map(t => t.trim());
        }
      }

      return {
        ...v,
        tags: parsedTags,
      };
    });

    return NextResponse.json({
      videos: enrichedVideos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total,
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json(
      { error: 'Error fetching videos' },
      { status: 500 }
    );
  }
}

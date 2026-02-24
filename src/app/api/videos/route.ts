export const dynamic = 'force-dynamic';

/**
 * API - Videos (public)
 * GET: Fetch all published videos, with optional category filter and pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTranslations, DB_SOURCE_LOCALE } from '@/lib/translation';
import { logger } from '@/lib/logger';
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

    // FIX: F69 - TODO: Add database indexes on Video.title, Video.description, Video.instructor
    // for search performance, or migrate to PostgreSQL full-text search (GIN index on tsvector)
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

    // FIX: F65 - Normalize tags parsing: try JSON array first, then CSV fallback, always filter empty entries
    const enrichedVideos = translatedVideos.map(v => {
      let parsedTags: string[] = [];
      if (v.tags) {
        try {
          const parsed = JSON.parse(v.tags);
          parsedTags = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
        } catch (error) {
          console.error('[Videos] Failed to parse video tags as JSON:', error);
          parsedTags = v.tags.split(',').map(t => t.trim());
        }
        parsedTags = parsedTags.filter(Boolean);
      }

      // F47 FIX: Strip internal translation records from public API response
      const { translations: _translations, ...publicFields } = v;
      return {
        ...publicFields,
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
    logger.error('Error fetching videos', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Error fetching videos' },
      { status: 500 }
    );
  }
}

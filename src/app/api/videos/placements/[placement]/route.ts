export const dynamic = 'force-dynamic';

/**
 * Public Videos by Placement API
 * GET - Get published videos for a specific placement
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

type RouteContext = { params: Promise<{ placement: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { placement } = await context.params;
    const { searchParams } = new URL(request.url);
    const contextId = searchParams.get('contextId');
    const locale = searchParams.get('locale') || 'en';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    // Validate placement enum
    const validPlacements = [
      'HOMEPAGE_HERO', 'HOMEPAGE_FEATURED', 'PRODUCT_PAGE', 'VIDEO_LIBRARY',
      'WEBINAR_ARCHIVE', 'LEARNING_CENTER', 'BLOG_EMBED', 'FAQ_SECTION',
      'CUSTOMER_ACCOUNT', 'AMBASSADOR_PAGE', 'CALCULATOR_HELP', 'LAB_RESULTS', 'COMMUNITY',
    ] as const;
    type PlacementEnum = typeof validPlacements[number];

    if (!validPlacements.includes(placement as PlacementEnum)) {
      return NextResponse.json({ error: 'Invalid placement' }, { status: 400 });
    }

    const placements = await prisma.videoPlacement.findMany({
      where: {
        placement: placement as PlacementEnum,
        isActive: true,
        ...(contextId ? { contextId } : {}),
        video: {
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
        },
      },
      orderBy: { sortOrder: 'asc' },
      take: limit,
      include: {
        video: {
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            thumbnailUrl: true,
            videoUrl: true,
            duration: true,
            views: true,
            contentType: true,
            source: true,
            translations: {
              where: { locale },
              select: { title: true, description: true },
              take: 1,
            },
            videoCategory: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    const videos = placements.map(p => {
      const v = p.video;
      const t = v.translations[0];
      return {
        ...v,
        title: t?.title || v.title,
        description: t?.description || v.description,
        translations: undefined,
      };
    });

    return NextResponse.json(
      { videos },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    logger.error('Public videos by placement GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

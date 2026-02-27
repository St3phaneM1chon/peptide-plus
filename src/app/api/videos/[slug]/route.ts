export const dynamic = 'force-dynamic';

/**
 * Public Video Detail API
 * GET - Get a single published video by slug
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale') || 'en';

    const video = await prisma.video.findUnique({
      where: { slug },
      include: {
        translations: { orderBy: { locale: 'asc' } },
        videoCategory: { select: { id: true, name: true, slug: true } },
        videoTags: { select: { tag: true } },
        placements: { where: { isActive: true }, select: { placement: true, contextId: true } },
        productLinks: {
          include: {
            product: {
              select: { id: true, name: true, slug: true, imageUrl: true, price: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Only show published videos publicly
    if (video.status !== 'PUBLISHED' && !video.isPublished) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Apply translation
    const translation = video.translations.find(t => t.locale === locale);
    const enriched = {
      ...video,
      title: translation?.title || video.title,
      description: translation?.description || video.description,
      tags: video.videoTags.map(vt => vt.tag),
    };

    // Remove internal translation records
    const { translations: _translations, videoTags: _videoTags, ...publicVideo } = enriched;
    void _translations;
    void _videoTags;

    return NextResponse.json(
      { video: publicVideo },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  } catch (error) {
    logger.error('Public video GET [slug] error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

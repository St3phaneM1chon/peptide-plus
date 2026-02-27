export const dynamic = 'force-dynamic';

/**
 * PUBLIC API - Videos
 * Returns published videos for the public video library.
 *
 * GET /api/videos?page=1&limit=20&search=X&categoryId=Y&contentType=Z&source=S&sort=newest
 *
 * No authentication required for PUBLIC videos.
 * Logged-in users may see additional visibility tiers based on role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth-config';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    // Filters
    const search = searchParams.get('search')?.trim() || '';
    const categoryId = searchParams.get('categoryId') || '';
    const contentType = searchParams.get('contentType') || '';
    const source = searchParams.get('source') || '';
    const sort = searchParams.get('sort') || 'newest';
    const locale = searchParams.get('locale') || 'en';

    // Determine visibility tiers based on session
    const allowedVisibilities: string[] = ['PUBLIC'];
    try {
      const session = await auth();
      if (session?.user) {
        allowedVisibilities.push('CUSTOMERS_ONLY');
        const role = (session.user as { role?: string }).role;
        if (role === 'EMPLOYEE' || role === 'ADMIN' || role === 'OWNER') {
          allowedVisibilities.push('EMPLOYEES_ONLY');
        }
        if (role === 'CLIENT' || role === 'ADMIN' || role === 'OWNER') {
          allowedVisibilities.push('CLIENTS_ONLY');
        }
      }
    } catch {
      // No session — public only
    }

    // Build where clause
    const where: Prisma.VideoWhereInput = {
      isPublished: true,
      status: 'PUBLISHED',
      visibility: { in: allowedVisibilities as Prisma.EnumContentVisibilityFilter['in'] },
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { videoTags: { some: { tag: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    if (categoryId) {
      where.videoCategoryId = categoryId;
    }

    if (contentType) {
      where.contentType = contentType as Prisma.EnumVideoContentTypeFilter['equals'];
    }

    if (source) {
      where.source = source as Prisma.EnumVideoSourceFilter['equals'];
    }

    // Sort order
    let orderBy: Prisma.VideoOrderByWithRelationInput;
    switch (sort) {
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'popular':
        orderBy = { views: 'desc' };
        break;
      case 'title':
        orderBy = { title: 'asc' };
        break;
      default: // 'newest'
        orderBy = { createdAt: 'desc' };
        break;
    }

    // Fetch videos + total count in parallel
    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          thumbnailUrl: true,
          videoUrl: true,
          duration: true,
          views: true,
          isFeatured: true,
          contentType: true,
          source: true,
          instructor: true,
          createdAt: true,
          videoCategory: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
            },
          },
          videoTags: {
            select: { tag: true },
          },
          translations: {
            where: { locale },
            select: {
              title: true,
              description: true,
            },
            take: 1,
          },
        },
      }),
      prisma.video.count({ where }),
    ]);

    // Fetch active categories (always returned for filter UI)
    const categories = await prisma.videoCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        icon: true,
        translations: {
          where: { locale },
          select: { name: true },
          take: 1,
        },
      },
    });

    // Map videos with translation overlay
    const mappedVideos = videos.map((v) => {
      const tr = v.translations[0];
      return {
        id: v.id,
        title: tr?.title || v.title,
        slug: v.slug,
        description: tr?.description || v.description,
        thumbnailUrl: v.thumbnailUrl,
        videoUrl: v.videoUrl,
        duration: v.duration,
        views: v.views,
        isFeatured: v.isFeatured,
        contentType: v.contentType,
        source: v.source,
        instructor: v.instructor,
        createdAt: v.createdAt,
        videoCategory: v.videoCategory,
        tags: v.videoTags.map((vt) => vt.tag),
      };
    });

    // Map categories with translation overlay
    const mappedCategories = categories.map((c) => {
      const tr = c.translations[0];
      return {
        id: c.id,
        name: tr?.name || c.name,
        slug: c.slug,
        icon: c.icon,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      videos: mappedVideos,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
      categories: mappedCategories,
    });
  } catch (error) {
    logger.error('Failed to fetch public videos', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to fetch videos' },
      { status: 500 }
    );
  }
}

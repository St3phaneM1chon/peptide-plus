export const dynamic = 'force-dynamic';

/**
 * Admin Videos API
 * GET  - List all videos with translations
 * POST - Create a new video
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { createVideoSchema } from '@/lib/validations/video';
import { enqueue } from '@/lib/translation';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// GET /api/admin/videos - List all videos
export const GET = withAdminGuard(async (request, _ctx) => {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const isPublished = searchParams.get('isPublished');
    const isFeatured = searchParams.get('isFeatured');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (isPublished === 'true') {
      where.isPublished = true;
    } else if (isPublished === 'false') {
      where.isPublished = false;
    }

    if (isFeatured === 'true') {
      where.isFeatured = true;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { instructor: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
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
          translations: {
            orderBy: { locale: 'asc' },
          },
        },
      }),
      prisma.video.count({ where }),
    ]);

    // FIX: F65 - Normalize tags parsing: try JSON array first, then CSV fallback, always filter empty entries
    const enrichedVideos = videos.map(v => {
      let parsedTags: string[] = [];
      if (v.tags) {
        try {
          const parsed = JSON.parse(v.tags);
          parsedTags = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
        } catch (error) {
          console.error('[AdminVideos] Failed to parse video tags as JSON:', error);
          parsedTags = v.tags.split(',').map(t => t.trim());
        }
        parsedTags = parsedTags.filter(Boolean);
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
    });
  } catch (error) {
    logger.error('Admin videos GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/admin/videos - Create a new video
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();

    // Validate with Zod
    const parsed = createVideoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const {
      title,
      description,
      thumbnailUrl,
      videoUrl,
      duration,
      category,
      tags,
      instructor,
      isFeatured,
      isPublished,
      locale,
      sortOrder,
      translations,
    } = parsed.data;

    // Generate slug from title
    const baseSlug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // FIX: F24 - Use single-query check + UUID suffix instead of while loop
    let slug = baseSlug;
    const existingSlug = await prisma.video.findUnique({ where: { slug } });
    if (existingSlug) {
      const { randomUUID } = await import('crypto');
      slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;
    }

    // Prepare tags as JSON string
    const tagsJson = tags
      ? (Array.isArray(tags) ? JSON.stringify(tags) : tags)
      : null;

    const video = await prisma.video.create({
      data: {
        title,
        slug,
        description: description || null,
        thumbnailUrl: thumbnailUrl || null,
        videoUrl: videoUrl || null,
        duration: duration || null,
        category: category || null,
        tags: tagsJson,
        instructor: instructor || null,
        isFeatured: isFeatured ?? false,
        isPublished: isPublished ?? false,
        locale: locale || 'en',
        sortOrder: sortOrder ?? 0,
        ...(translations && translations.length > 0
          ? {
              translations: {
                create: translations.map((t) => ({
                  locale: t.locale,
                  title: t.title || null,
                  description: t.description || null,
                })),
              },
            }
          : {}),
      },
      include: {
        translations: true,
      },
    });

    // F48 FIX: Catch and log enqueue errors instead of letting them fail silently
    try {
      await enqueue.video(video.id);
    } catch (enqueueErr) {
      logger.error('Failed to enqueue video translation', { error: enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr) });
      // Non-blocking: video is created, translation will need manual trigger
    }

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_VIDEO',
      targetType: 'Video',
      targetId: video.id,
      newValue: { title, slug: video.slug, category, isPublished: isPublished ?? false },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ video }, { status: 201 });
  } catch (error) {
    logger.error('Admin videos POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

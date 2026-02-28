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
import { sanitizeUrl } from '@/lib/sanitize';

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

    const featuredClientIdParam = searchParams.get('featuredClientId');
    if (featuredClientIdParam) {
      where.featuredClientId = featuredClientIdParam;
    }

    const sourceParam = searchParams.get('source');
    if (sourceParam) {
      where.source = sourceParam;
    }

    const statusParam = searchParams.get('status');
    if (statusParam) {
      where.status = statusParam;
    }

    const contentTypeParam = searchParams.get('contentType');
    if (contentTypeParam) {
      where.contentType = contentTypeParam;
    }

    if (search) {
      // IMP-051: TODO: Add tags to search (tags is stored as JSON string, needs contains search)
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { instructor: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { tags: { contains: search, mode: 'insensitive' } }, // IMP-051: Search within tags JSON string
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
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          thumbnailUrl: true,
          videoUrl: true,
          duration: true,
          category: true,
          tags: true,
          instructor: true,
          isFeatured: true,
          isPublished: true,
          locale: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
          // Content Hub fields
          contentType: true,
          source: true,
          sourceUrl: true,
          visibility: true,
          status: true,
          videoCategoryId: true,
          featuredClientId: true,
          views: true,
          videoCategory: { select: { id: true, name: true, slug: true } },
          translations: {
            orderBy: { locale: 'asc' },
            select: { id: true, locale: true, title: true, description: true },
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
          logger.error('[AdminVideos] Failed to parse video tags as JSON', { error: error instanceof Error ? error.message : String(error) });
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
      contentType,
      source,
      sourceUrl,
      visibility,
      status,
      videoCategoryId,
      createdById,
      featuredClientId,
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
    const existingSlug = await prisma.video.findUnique({ where: { slug }, select: { id: true } });
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
        // F16 FIX: Sanitize URL to prevent SSRF/XSS
        thumbnailUrl: thumbnailUrl ? sanitizeUrl(thumbnailUrl) : null,
        videoUrl: videoUrl ? sanitizeUrl(videoUrl) : null,
        duration: duration || null,
        category: category || null,
        tags: tagsJson,
        instructor: instructor || null,
        isFeatured: isFeatured ?? false,
        isPublished: isPublished ?? false,
        locale: locale || 'en',
        sortOrder: sortOrder ?? 0,
        // Content Hub fields
        contentType: contentType ?? 'OTHER',
        source: source ?? 'YOUTUBE',
        sourceUrl: sourceUrl ? sanitizeUrl(sourceUrl) : null,
        visibility: visibility ?? 'PUBLIC',
        status: status ?? 'DRAFT',
        videoCategoryId: videoCategoryId || null,
        createdById: createdById || session.user.id,
        featuredClientId: featuredClientId || null,
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
        videoCategory: { select: { id: true, name: true, slug: true } },
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

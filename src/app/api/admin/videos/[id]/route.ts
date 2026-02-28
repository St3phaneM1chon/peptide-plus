export const dynamic = 'force-dynamic';

/**
 * Admin Video Detail API
 * GET    - Get single video with translations
 * PATCH  - Update video
 * DELETE - Delete video
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { patchVideoSchema } from '@/lib/validations/video';
import { enqueue } from '@/lib/translation';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';
import { sanitizeUrl } from '@/lib/sanitize';

// GET /api/admin/videos/[id] - Get single video
export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const id = params?.id as string;

    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        translations: {
          orderBy: { locale: 'asc' },
        },
        videoCategory: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        featuredClient: { select: { id: true, name: true, email: true } },
        placements: { orderBy: { sortOrder: 'asc' } },
        productLinks: {
          orderBy: { sortOrder: 'asc' },
          include: {
            product: { select: { id: true, name: true, slug: true, imageUrl: true, price: true } },
          },
        },
        videoTags: { orderBy: { tag: 'asc' } },
        consents: {
          orderBy: { createdAt: 'desc' },
          include: {
            client: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Parse legacy tags
    let parsedTags: string[] = [];
    if (video.tags) {
      try {
        parsedTags = JSON.parse(video.tags);
      } catch (error) {
        logger.error('[AdminVideoById] Failed to parse video tags as JSON', { error: error instanceof Error ? error.message : String(error) });
        parsedTags = video.tags.split(',').map(t => t.trim());
      }
    }

    // Merge normalized tags with legacy tags
    const normalizedTags = video.videoTags.map(vt => vt.tag);
    const allTags = normalizedTags.length > 0 ? normalizedTags : parsedTags;

    return NextResponse.json({
      video: {
        ...video,
        tags: allTags,
      },
    });
  } catch (error) {
    logger.error('Admin video GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/videos/[id] - Update video
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params?.id as string;

    const existing = await prisma.video.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Validate with Zod
    const parsed = patchVideoSchema.safeParse(body);
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
      views,
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

    // Build update data - only include provided fields
    const updateData: Record<string, unknown> = {};

    if (title !== undefined) {
      updateData.title = title;

      // Regenerate slug if title changes
      const baseSlug = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // FIX: F24 - Use single-query check + UUID suffix instead of while loop
      let slug = baseSlug;
      const existingSlug = await prisma.video.findUnique({ where: { slug } });
      if (existingSlug && existingSlug.id !== id) {
        const { randomUUID } = await import('crypto');
        slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;
      }
      updateData.slug = slug;
    }

    if (description !== undefined) updateData.description = description;
    // F16 FIX: Sanitize URL to prevent SSRF/XSS
    if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl ? sanitizeUrl(thumbnailUrl) : thumbnailUrl;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl ? sanitizeUrl(videoUrl) : videoUrl;
    if (duration !== undefined) updateData.duration = duration;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) {
      updateData.tags = tags
        ? (Array.isArray(tags) ? JSON.stringify(tags) : tags)
        : null;
    }
    if (instructor !== undefined) updateData.instructor = instructor;
    // F15 FIX: Validate views is a non-negative finite number
    if (views !== undefined) {
      if (!Number.isFinite(views) || views < 0) {
        return NextResponse.json(
          { error: 'views must be a non-negative finite number' },
          { status: 400 }
        );
      }
      updateData.views = views;
    }
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    if (isPublished !== undefined) updateData.isPublished = isPublished;
    if (locale !== undefined) updateData.locale = locale;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    // Content Hub fields
    if (contentType !== undefined) updateData.contentType = contentType;
    if (source !== undefined) updateData.source = source;
    if (sourceUrl !== undefined) updateData.sourceUrl = sourceUrl ? sanitizeUrl(sourceUrl) : sourceUrl;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (status !== undefined) {
      // Enforce consent rule: cannot publish if featuredClientId is set and no granted consent
      if (status === 'PUBLISHED' && (featuredClientId || existing.featuredClientId)) {
        const clientId = featuredClientId || existing.featuredClientId;
        const grantedConsent = await prisma.siteConsent.findFirst({
          where: { videoId: id, clientId: clientId!, status: 'GRANTED' },
        });
        if (!grantedConsent) {
          return NextResponse.json(
            { error: 'Cannot publish: consent from featured client is required. Request consent first.' },
            { status: 400 }
          );
        }
      }
      updateData.status = status;
    }
    if (videoCategoryId !== undefined) updateData.videoCategoryId = videoCategoryId || null;
    if (createdById !== undefined) updateData.createdById = createdById || null;
    if (featuredClientId !== undefined) updateData.featuredClientId = featuredClientId || null;

    // Update video
    const video = await prisma.video.update({
      where: { id },
      data: updateData,
      include: {
        translations: true,
      },
    });

    // Auto-enqueue translation (force re-translate on update)
    enqueue.video(id, true);

    // F76 FIX: Log admin action BEFORE translations block to ensure audit logging for all PATCH paths
    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_VIDEO',
      targetType: 'Video',
      targetId: id,
      previousValue: { title: existing.title, isPublished: existing.isPublished },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    // Handle translations if provided (batched in single transaction)
    if (translations && Array.isArray(translations)) {
      const validTranslations = translations.filter((t: { locale?: string }) => t.locale);
      if (validTranslations.length > 0) {
        await prisma.$transaction(
          validTranslations.map((t: { locale: string; title?: string; description?: string; isApproved?: boolean }) =>
            prisma.videoTranslation.upsert({
              where: { videoId_locale: { videoId: id, locale: t.locale } },
              update: {
                ...(t.title !== undefined && { title: t.title }),
                ...(t.description !== undefined && { description: t.description }),
                ...(t.isApproved !== undefined && { isApproved: t.isApproved }),
              },
              create: {
                videoId: id,
                locale: t.locale,
                title: t.title || null,
                description: t.description || null,
              },
            })
          )
        );
      }

      // Re-fetch with updated translations
      const updated = await prisma.video.findUnique({
        where: { id },
        include: { translations: { orderBy: { locale: 'asc' } } },
      });

      return NextResponse.json({ video: updated });
    }

    return NextResponse.json({ video });
  } catch (error) {
    logger.error('Admin video PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/videos/[id] - Delete video
export const DELETE = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params?.id as string;

    const existing = await prisma.video.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Translations are cascade-deleted due to onDelete: Cascade in the schema
    await prisma.video.delete({
      where: { id },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_VIDEO',
      targetType: 'Video',
      targetId: id,
      previousValue: { title: existing.title },
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Video "${existing.title}" deleted successfully`,
    });
  } catch (error) {
    logger.error('Admin video DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

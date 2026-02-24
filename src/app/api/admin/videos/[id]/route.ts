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

// GET /api/admin/videos/[id] - Get single video
export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const id = params!.id;

    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        translations: {
          orderBy: { locale: 'asc' },
        },
      },
    });

    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Parse tags
    let parsedTags: string[] = [];
    if (video.tags) {
      try {
        parsedTags = JSON.parse(video.tags);
      } catch (error) {
        logger.error('[AdminVideoById] Failed to parse video tags as JSON', { error: error instanceof Error ? error.message : String(error) });
        parsedTags = video.tags.split(',').map(t => t.trim());
      }
    }

    return NextResponse.json({
      video: {
        ...video,
        tags: parsedTags,
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
    const id = params!.id;

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
    if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (duration !== undefined) updateData.duration = duration;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) {
      updateData.tags = tags
        ? (Array.isArray(tags) ? JSON.stringify(tags) : tags)
        : null;
    }
    if (instructor !== undefined) updateData.instructor = instructor;
    if (views !== undefined) updateData.views = views;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    if (isPublished !== undefined) updateData.isPublished = isPublished;
    if (locale !== undefined) updateData.locale = locale;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

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

    // Handle translations if provided
    if (translations && Array.isArray(translations)) {
      for (const t of translations) {
        if (!t.locale) continue;

        await prisma.videoTranslation.upsert({
          where: {
            videoId_locale: {
              videoId: id,
              locale: t.locale,
            },
          },
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
        });
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
    const id = params!.id;

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

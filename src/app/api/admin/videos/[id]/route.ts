export const dynamic = 'force-dynamic';

/**
 * Admin Video Detail API
 * GET    - Get single video with translations
 * PATCH  - Update video
 * DELETE - Delete video
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { enqueue } from '@/lib/translation';

// GET /api/admin/videos/[id] - Get single video
export const GET = withAdminGuard(async (_request, { session, params }) => {
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
      } catch {
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
    console.error('Admin video GET error:', error);
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
    } = body;

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

      let slug = baseSlug;
      let slugSuffix = 1;
      let existingSlug = await prisma.video.findUnique({ where: { slug } });
      while (existingSlug && existingSlug.id !== id) {
        slug = `${baseSlug}-${slugSuffix}`;
        slugSuffix++;
        existingSlug = await prisma.video.findUnique({ where: { slug } });
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
    if (views !== undefined) updateData.views = parseInt(String(views), 10);
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
    console.error('Admin video PATCH error:', error);
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

    return NextResponse.json({
      success: true,
      message: `Video "${existing.title}" deleted successfully`,
    });
  } catch (error) {
    console.error('Admin video DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

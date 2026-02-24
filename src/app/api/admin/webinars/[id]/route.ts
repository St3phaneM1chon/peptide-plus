export const dynamic = 'force-dynamic';

/**
 * Admin Webinar Detail API
 * GET    - Get single webinar with translations
 * PATCH  - Update webinar
 * DELETE - Delete webinar
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { enqueue } from '@/lib/translation';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const webinarTranslationSchema = z.object({
  locale: z.string().min(2).max(10),
  title: z.string().nullish(),
  description: z.string().nullish(),
  speakerTitle: z.string().nullish(),
  isApproved: z.boolean().nullish(),
});

const updateWebinarSchema = z.object({
  title: z.string().min(1).nullish(),
  description: z.string().nullish(),
  speaker: z.string().nullish(),
  speakerTitle: z.string().nullish(),
  speakerImage: z.string().url().nullish(),
  scheduledAt: z.string().nullish(),
  duration: z.union([z.number(), z.string()]).nullish(),
  category: z.string().nullish(),
  tags: z.union([z.array(z.string()), z.string()]).nullish(),
  registrationUrl: z.string().url().nullish(),
  recordingUrl: z.string().url().nullish(),
  thumbnailUrl: z.string().url().nullish(),
  maxAttendees: z.union([z.number(), z.string()]).nullish(),
  registeredCount: z.union([z.number(), z.string()]).nullish(),
  isFeatured: z.boolean().nullish(),
  isPublished: z.boolean().nullish(),
  isLive: z.boolean().nullish(),
  locale: z.string().min(2).max(10).nullish(),
  sortOrder: z.number().int().nullish(),
  translations: z.array(webinarTranslationSchema).nullish(),
});

// GET /api/admin/webinars/[id] - Get single webinar
export const GET = withAdminGuard(async (_request: NextRequest, { params }) => {
  try {
    const id = params!.id;

    const webinar = await prisma.webinar.findUnique({
      where: { id },
      include: {
        translations: {
          orderBy: { locale: 'asc' },
        },
      },
    });

    if (!webinar) {
      return NextResponse.json(
        { error: 'Webinar not found' },
        { status: 404 }
      );
    }

    // Derive status
    let status: string;
    if (webinar.isLive) {
      status = 'LIVE';
    } else if (!webinar.isPublished && (!webinar.scheduledAt || webinar.scheduledAt > new Date())) {
      status = 'DRAFT';
    } else if (webinar.isPublished && webinar.scheduledAt && webinar.scheduledAt > new Date()) {
      status = 'SCHEDULED';
    } else if (webinar.isPublished && webinar.scheduledAt && webinar.scheduledAt <= new Date()) {
      status = 'COMPLETED';
    } else {
      status = 'DRAFT';
    }

    // Parse tags
    let parsedTags: string[] = [];
    if (webinar.tags) {
      try {
        parsedTags = JSON.parse(webinar.tags);
      } catch {
        parsedTags = webinar.tags.split(',').map(t => t.trim());
      }
    }

    return NextResponse.json({
      webinar: {
        ...webinar,
        status,
        tags: parsedTags,
      },
    });
  } catch (error) {
    logger.error('Admin webinar GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/webinars/[id] - Update webinar
export const PATCH = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const id = params!.id;

    const existing = await prisma.webinar.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Webinar not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateWebinarSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const {
      title,
      description,
      speaker,
      speakerTitle,
      speakerImage,
      scheduledAt,
      duration,
      category,
      tags,
      registrationUrl,
      recordingUrl,
      thumbnailUrl,
      maxAttendees,
      registeredCount,
      isFeatured,
      isPublished,
      isLive,
      locale,
      sortOrder,
      translations,
    } = parsed.data;

    // Build update data - only include provided fields
    const updateData: Record<string, unknown> = {};

    if (title !== undefined && title !== null) {
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
      let existingSlug = await prisma.webinar.findUnique({ where: { slug } });
      while (existingSlug && existingSlug.id !== id) {
        slug = `${baseSlug}-${slugSuffix}`;
        slugSuffix++;
        existingSlug = await prisma.webinar.findUnique({ where: { slug } });
      }
      updateData.slug = slug;
    }

    if (description !== undefined) updateData.description = description;
    if (speaker !== undefined) updateData.speaker = speaker;
    if (speakerTitle !== undefined) updateData.speakerTitle = speakerTitle;
    if (speakerImage !== undefined) updateData.speakerImage = speakerImage;
    if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (duration !== undefined) updateData.duration = duration ? parseInt(String(duration), 10) : null;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) {
      updateData.tags = tags
        ? (Array.isArray(tags) ? JSON.stringify(tags) : tags)
        : null;
    }
    if (registrationUrl !== undefined) updateData.registrationUrl = registrationUrl;
    if (recordingUrl !== undefined) updateData.recordingUrl = recordingUrl;
    if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;
    if (maxAttendees !== undefined) updateData.maxAttendees = maxAttendees ? parseInt(String(maxAttendees), 10) : null;
    if (registeredCount !== undefined) updateData.registeredCount = parseInt(String(registeredCount), 10);
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    if (isPublished !== undefined) updateData.isPublished = isPublished;
    if (isLive !== undefined) updateData.isLive = isLive;
    if (locale !== undefined) updateData.locale = locale;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    // Update webinar
    const webinar = await prisma.webinar.update({
      where: { id },
      data: updateData,
      include: {
        translations: true,
      },
    });

    // Auto-enqueue translation (force re-translate on update)
    enqueue.webinar(id, true);

    // Handle translations if provided
    if (translations && Array.isArray(translations)) {
      for (const t of translations) {
        if (!t.locale) continue;

        await prisma.webinarTranslation.upsert({
          where: {
            webinarId_locale: {
              webinarId: id,
              locale: t.locale,
            },
          },
          update: {
            ...(t.title !== undefined ? { title: String(t.title) } : {}),
            ...(t.description !== undefined ? { description: String(t.description) } : {}),
            ...(t.speakerTitle !== undefined ? { speakerTitle: String(t.speakerTitle) } : {}),
            ...(t.isApproved !== undefined ? { isApproved: Boolean(t.isApproved) } : {}),
          },
          create: {
            webinarId: id,
            locale: t.locale,
            title: t.title || null,
            description: t.description || null,
            speakerTitle: t.speakerTitle || null,
          },
        });
      }

      // Re-fetch with updated translations
      const updated = await prisma.webinar.findUnique({
        where: { id },
        include: { translations: { orderBy: { locale: 'asc' } } },
      });

      return NextResponse.json({ webinar: updated });
    }

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_WEBINAR',
      targetType: 'Webinar',
      targetId: id,
      previousValue: { title: existing.title, isPublished: existing.isPublished, isLive: existing.isLive },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ webinar });
  } catch (error) {
    logger.error('Admin webinar PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/webinars/[id] - Delete webinar
export const DELETE = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const id = params!.id;

    const existing = await prisma.webinar.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Webinar not found' },
        { status: 404 }
      );
    }

    // Translations are cascade-deleted due to onDelete: Cascade in the schema
    await prisma.webinar.delete({
      where: { id },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_WEBINAR',
      targetType: 'Webinar',
      targetId: id,
      previousValue: { title: existing.title },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Webinar "${existing.title}" deleted successfully`,
    });
  } catch (error) {
    logger.error('Admin webinar DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

export const dynamic = 'force-dynamic';

/**
 * Admin Video Category Detail API
 * GET    - Get a single video category
 * PATCH  - Update a video category
 * DELETE - Delete a video category
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { patchVideoCategorySchema } from '@/lib/validations/video-category';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/video-categories/[id]
export const GET = withAdminGuard(async (_request, { routeContext }) => {
  try {
    const { id } = await (routeContext as RouteContext).params;

    const category = await prisma.videoCategory.findUnique({
      where: { id },
      include: {
        translations: { orderBy: { locale: 'asc' } },
        children: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: { id: true, name: true, slug: true, isActive: true, sortOrder: true },
        },
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { videos: true, children: true } },
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'Video category not found' }, { status: 404 });
    }

    return NextResponse.json({ category });
  } catch (error) {
    logger.error('Admin video-categories GET [id] error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// PATCH /api/admin/video-categories/[id]
export const PATCH = withAdminGuard(async (request, { session, routeContext }) => {
  try {
    const { id } = await (routeContext as RouteContext).params;
    const body = await request.json();

    const parsed = patchVideoCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const existing = await prisma.videoCategory.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Video category not found' }, { status: 404 });
    }

    const { translations, parentId, name, ...rest } = parsed.data;

    // Prevent circular parent reference
    if (parentId === id) {
      return NextResponse.json({ error: 'A category cannot be its own parent' }, { status: 400 });
    }

    // Validate parentId exists if provided
    if (parentId) {
      const parent = await prisma.videoCategory.findUnique({ where: { id: parentId }, select: { id: true } });
      if (!parent) {
        return NextResponse.json({ error: 'Parent category not found' }, { status: 400 });
      }
    }

    // Regenerate slug if name changes
    let slug = rest.slug;
    if (name && !slug) {
      const baseSlug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      slug = baseSlug;
      const existingSlug = await prisma.videoCategory.findFirst({
        where: { slug, id: { not: id } },
        select: { id: true },
      });
      if (existingSlug) {
        const { randomUUID } = await import('crypto');
        slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;
      }
    }

    const updateData: Record<string, unknown> = { ...rest };
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (parentId !== undefined) updateData.parentId = parentId || null;

    const category = await prisma.videoCategory.update({
      where: { id },
      data: updateData,
      include: { translations: true },
    });

    // Upsert translations
    if (translations && translations.length > 0) {
      for (const t of translations) {
        await prisma.videoCategoryTranslation.upsert({
          where: { videoCategoryId_locale: { videoCategoryId: id, locale: t.locale } },
          update: {
            name: t.name ?? undefined,
            description: t.description ?? undefined,
            isApproved: t.isApproved ?? undefined,
          },
          create: {
            videoCategoryId: id,
            locale: t.locale,
            name: t.name || null,
            description: t.description || null,
          },
        });
      }
    }

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_VIDEO_CATEGORY',
      targetType: 'VideoCategory',
      targetId: id,
      newValue: parsed.data,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    // Refetch with translations
    const updated = await prisma.videoCategory.findUnique({
      where: { id },
      include: { translations: true },
    });

    return NextResponse.json({ category: updated });
  } catch (error) {
    logger.error('Admin video-categories PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// DELETE /api/admin/video-categories/[id]
export const DELETE = withAdminGuard(async (_request, { session, routeContext }) => {
  try {
    const { id } = await (routeContext as RouteContext).params;

    const category = await prisma.videoCategory.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { videos: true, children: true } } },
    });

    if (!category) {
      return NextResponse.json({ error: 'Video category not found' }, { status: 404 });
    }

    if (category._count.videos > 0) {
      return NextResponse.json(
        { error: `Cannot delete category with ${category._count.videos} video(s). Reassign them first.` },
        { status: 409 }
      );
    }

    if (category._count.children > 0) {
      return NextResponse.json(
        { error: `Cannot delete category with ${category._count.children} sub-categorie(s). Delete or reassign them first.` },
        { status: 409 }
      );
    }

    await prisma.videoCategory.delete({ where: { id } });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_VIDEO_CATEGORY',
      targetType: 'VideoCategory',
      targetId: id,
      newValue: { name: category.name },
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Admin video-categories DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

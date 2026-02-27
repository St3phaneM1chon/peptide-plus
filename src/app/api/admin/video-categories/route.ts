export const dynamic = 'force-dynamic';

/**
 * Admin Video Categories API
 * GET  - List all video categories (tree structure)
 * POST - Create a new video category
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { createVideoCategorySchema } from '@/lib/validations/video-category';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// GET /api/admin/video-categories - List all video categories
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const flat = searchParams.get('flat') === 'true';
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const where: Record<string, unknown> = {};
    if (activeOnly) where.isActive = true;

    const categories = await prisma.videoCategory.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        translations: {
          orderBy: { locale: 'asc' },
          select: { id: true, locale: true, name: true, description: true },
        },
        _count: { select: { videos: true, children: true } },
      },
    });

    if (flat) {
      return NextResponse.json({ categories });
    }

    // Build tree structure
    const map = new Map<string, typeof categories[0] & { children: typeof categories }>();
    const roots: (typeof categories[0] & { children: typeof categories })[] = [];

    for (const cat of categories) {
      map.set(cat.id, { ...cat, children: [] });
    }

    for (const cat of categories) {
      const node = map.get(cat.id)!;
      if (cat.parentId && map.has(cat.parentId)) {
        map.get(cat.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return NextResponse.json({ categories: roots });
  } catch (error) {
    logger.error('Admin video-categories GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// POST /api/admin/video-categories - Create a new video category
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = createVideoCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { name, slug: providedSlug, description, icon, sortOrder, isActive, parentId, translations } = parsed.data;

    // Validate parentId exists if provided
    if (parentId) {
      const parent = await prisma.videoCategory.findUnique({ where: { id: parentId }, select: { id: true } });
      if (!parent) {
        return NextResponse.json({ error: 'Parent category not found' }, { status: 400 });
      }
    }

    // Generate slug
    const baseSlug = (providedSlug || name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    const existing = await prisma.videoCategory.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      const { randomUUID } = await import('crypto');
      slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;
    }

    const category = await prisma.videoCategory.create({
      data: {
        name,
        slug,
        description: description || null,
        icon: icon || null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
        parentId: parentId || null,
        ...(translations && translations.length > 0
          ? {
              translations: {
                create: translations.map((t) => ({
                  locale: t.locale,
                  name: t.name || null,
                  description: t.description || null,
                })),
              },
            }
          : {}),
      },
      include: { translations: true },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_VIDEO_CATEGORY',
      targetType: 'VideoCategory',
      targetId: category.id,
      newValue: { name, slug: category.slug, parentId },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    logger.error('Admin video-categories POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

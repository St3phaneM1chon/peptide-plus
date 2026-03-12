export const dynamic = 'force-dynamic';

/**
 * Admin Categories API
 * GET  - List product categories with hierarchy
 * POST - Create a new product category
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(200).trim(),
  slug: z.string().max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable().or(z.literal('')),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  parentId: z.string().optional().nullable(),
});

// GET /api/admin/categories - List categories
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const skip = (page - 1) * limit;
    const flat = searchParams.get('flat') === 'true';

    const [data, total] = await Promise.all([
      prisma.category.findMany({
        where: flat ? {} : { parentId: null },
        take: limit,
        skip,
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          imageUrl: true,
          sortOrder: true,
          isActive: true,
          parentId: true,
          createdAt: true,
          updatedAt: true,
          translations: {
            select: {
              id: true,
              locale: true,
              name: true,
              description: true,
              isApproved: true,
              qualityLevel: true,
            },
          },
          children: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              imageUrl: true,
              sortOrder: true,
              isActive: true,
              parentId: true,
              createdAt: true,
              updatedAt: true,
              translations: {
                select: {
                  id: true,
                  locale: true,
                  name: true,
                  description: true,
                  isApproved: true,
                  qualityLevel: true,
                },
              },
            },
          },
          _count: { select: { products: true } },
        },
      }),
      prisma.category.count(flat ? undefined : { where: { parentId: null } }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    logger.error('Admin categories GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// POST /api/admin/categories - Create a new category
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { name, slug: providedSlug, description, imageUrl, sortOrder, isActive, parentId } = parsed.data;

    // Validate parentId exists if provided
    if (parentId) {
      const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { id: true } });
      if (!parent) {
        return NextResponse.json({ error: 'Parent category not found' }, { status: 400 });
      }
    }

    // Generate slug from name if not provided
    const baseSlug = (providedSlug || name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    let slug = baseSlug;
    const existingSlug = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
    if (existingSlug) {
      const { randomUUID } = await import('crypto');
      slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        imageUrl: imageUrl?.trim() || null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
        parentId: parentId || null,
      },
      include: {
        translations: true,
        children: true,
        _count: { select: { products: true } },
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_CATEGORY',
      targetType: 'Category',
      targetId: category.id,
      newValue: { name: category.name, slug: category.slug, parentId: category.parentId },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ data: category }, { status: 201 });
  } catch (error) {
    logger.error('Admin categories POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

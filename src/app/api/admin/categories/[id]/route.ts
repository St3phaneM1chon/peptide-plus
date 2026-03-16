export const dynamic = 'force-dynamic';

/**
 * Admin Category Detail API
 * GET    - Get a single category with translations and children
 * PATCH  - Update a category
 * DELETE - Delete a category (only if no products or children)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

const updateCategorySchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  slug: z.string().max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable().or(z.literal('')),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  parentId: z.string().optional().nullable(),
});

// GET /api/admin/categories/[id]
export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const id = params!.id;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        translations: true,
        children: {
          orderBy: { sortOrder: 'asc' },
          include: {
            translations: true,
            _count: { select: { products: true } },
          },
        },
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { products: true, children: true } },
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ data: category });
  } catch (error) {
    logger.error('Admin category GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// PATCH /api/admin/categories/[id]
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();
    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data' },
        { status: 400 }
      );
    }

    const existing = await prisma.category.findUnique({ where: { id }, select: { id: true, name: true, slug: true, isActive: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const { name, slug: providedSlug, description, imageUrl, sortOrder, isActive, parentId } = parsed.data;

    // Prevent circular parent reference
    if (parentId === id) {
      return NextResponse.json({ error: 'A category cannot be its own parent' }, { status: 400 });
    }

    // Validate parentId exists if provided and check circular reference
    if (parentId) {
      let currentId: string | null = parentId;
      const visited = new Set<string>([id]);
      let depth = 0;
      while (currentId && depth < 20) {
        if (visited.has(currentId)) {
          return NextResponse.json({ error: 'Circular parent reference detected' }, { status: 400 });
        }
        visited.add(currentId);
        const ancestor: { parentId: string | null } | null = await prisma.category.findUnique({
          where: { id: currentId },
          select: { parentId: true },
        });
        if (!ancestor) {
          if (currentId === parentId) {
            return NextResponse.json({ error: 'Parent category not found' }, { status: 400 });
          }
          break;
        }
        currentId = ancestor.parentId;
        depth++;
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl?.trim() || null;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (parentId !== undefined) updateData.parentId = parentId || null;

    // Handle slug: regenerate if name changed and no explicit slug provided
    if (providedSlug !== undefined) {
      updateData.slug = providedSlug;
    } else if (name !== undefined) {
      const baseSlug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      let slug = baseSlug;
      const existingSlug = await prisma.category.findFirst({
        where: { slug, id: { not: id } },
        select: { id: true },
      });
      if (existingSlug) {
        const { randomUUID } = await import('crypto');
        slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;
      }
      updateData.slug = slug;
    }

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
      include: {
        translations: true,
        children: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { products: true, children: true } },
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_CATEGORY',
      targetType: 'Category',
      targetId: id,
      previousValue: { name: existing.name, slug: existing.slug, isActive: existing.isActive },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err) => { logger.error('[admin/categories/id] Non-blocking operation failed:', err); });

    return NextResponse.json({ data: category });
  } catch (error) {
    logger.error('Admin category PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// DELETE /api/admin/categories/[id]
export const DELETE = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

    const category = await prisma.category.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        _count: { select: { products: true, children: true } },
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    if (category._count.products > 0) {
      return NextResponse.json(
        { error: `Cannot delete category with ${category._count.products} product(s). Reassign them first.` },
        { status: 409 }
      );
    }

    if (category._count.children > 0) {
      return NextResponse.json(
        { error: `Cannot delete category with ${category._count.children} sub-categorie(s). Delete or reassign them first.` },
        { status: 409 }
      );
    }

    // Delete translations first, then category
    await prisma.$transaction(async (tx) => {
      await tx.categoryTranslation.deleteMany({ where: { categoryId: id } });
      await tx.category.delete({ where: { id } });
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_CATEGORY',
      targetType: 'Category',
      targetId: id,
      previousValue: { name: category.name },
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch((err) => { logger.error('[admin/categories/id] Non-blocking operation failed:', err); });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Admin category DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

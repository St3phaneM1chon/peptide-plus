export const dynamic = 'force-dynamic';

/**
 * Admin CMS Collection Items API
 * GET    /api/admin/cms/collections/:id/items - List items in a collection
 * POST   /api/admin/cms/collections/:id/items - Create a new item
 * PUT    /api/admin/cms/collections/:id/items - Update an item
 * DELETE /api/admin/cms/collections/:id/items?itemId=xxx - Delete an item
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiPaginated, apiSuccess, apiError } from '@/lib/api-response';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createItemSchema = z.object({
  data: z.record(z.unknown()),
  slug: z.string().max(200).trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens').optional().nullable(),
  isPublished: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(99999).optional().default(0),
});

const updateItemSchema = z.object({
  itemId: z.string().min(1),
  data: z.record(z.unknown()).optional(),
  slug: z.string().max(200).trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens').optional().nullable(),
  isPublished: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(99999).optional(),
});

// ---------------------------------------------------------------------------
// GET: List items in a collection
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id: collectionId } = await context.params;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
  const skip = (page - 1) * limit;

  // Verify collection exists
  const collection = await prisma.cmsCollection.findUnique({ where: { id: collectionId } });
  if (!collection) {
    return apiError('Collection not found', 'NOT_FOUND', { status: 404 });
  }

  const [data, total] = await Promise.all([
    prisma.cmsItem.findMany({
      where: { collectionId },
      take: limit,
      skip,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.cmsItem.count({ where: { collectionId } }),
  ]);

  return apiPaginated(data, page, limit, total, { request });
});

// ---------------------------------------------------------------------------
// POST: Create an item
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id: collectionId } = await context.params;
  const body = await request.json();
  const parsed = createItemSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Validation failed', 'VALIDATION_ERROR', { status: 400, details: parsed.error.flatten().fieldErrors });
  }

  // Verify collection exists
  const collection = await prisma.cmsCollection.findUnique({ where: { id: collectionId } });
  if (!collection) {
    return apiError('Collection not found', 'NOT_FOUND', { status: 404 });
  }

  const item = await prisma.cmsItem.create({
    data: {
      collectionId,
      data: JSON.parse(JSON.stringify(parsed.data.data)),
      slug: parsed.data.slug,
      isPublished: parsed.data.isPublished,
      sortOrder: parsed.data.sortOrder,
    },
  });

  return apiSuccess(item, { status: 201 });
});

// ---------------------------------------------------------------------------
// PUT: Update an item
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id: collectionId } = await context.params;
  const body = await request.json();
  const parsed = updateItemSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Validation failed', 'VALIDATION_ERROR', { status: 400, details: parsed.error.flatten().fieldErrors });
  }

  const { itemId, ...updateData } = parsed.data;

  // Verify item belongs to this collection
  const existing = await prisma.cmsItem.findFirst({
    where: { id: itemId, collectionId },
  });
  if (!existing) {
    return apiError('Item not found in this collection', 'NOT_FOUND', { status: 404 });
  }

  const item = await prisma.cmsItem.update({
    where: { id: itemId },
    data: {
      ...updateData,
      data: updateData.data ? (updateData.data as unknown as import('@prisma/client').Prisma.InputJsonValue) : undefined,
    },
  });

  return apiSuccess(item);
});

// ---------------------------------------------------------------------------
// DELETE: Delete an item
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id: collectionId } = await context.params;
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get('itemId');

  if (!itemId) {
    return apiError('Missing item id', 'VALIDATION_ERROR', { status: 400 });
  }

  // Verify item belongs to this collection
  const existing = await prisma.cmsItem.findFirst({
    where: { id: itemId, collectionId },
  });
  if (!existing) {
    return apiError('Item not found in this collection', 'NOT_FOUND', { status: 404 });
  }

  await prisma.cmsItem.delete({ where: { id: itemId } });

  return apiSuccess({ deleted: true });
});

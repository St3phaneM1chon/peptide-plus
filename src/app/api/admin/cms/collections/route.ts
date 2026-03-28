export const dynamic = 'force-dynamic';

/**
 * Admin CMS Collections API
 * GET  /api/admin/cms/collections - List collections with pagination
 * POST /api/admin/cms/collections - Create a new collection
 * PUT  /api/admin/cms/collections - Update an existing collection
 * DELETE /api/admin/cms/collections?id=xxx - Delete a collection
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiPaginated, apiSuccess, apiError } from '@/lib/api-response';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const fieldSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  type: z.enum(['text', 'textarea', 'number', 'boolean', 'date', 'url', 'image', 'select', 'rich-text', 'color', 'email']),
  required: z.boolean().optional().default(false),
  options: z.array(z.string()).optional(), // for select type
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

const createCollectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim(),
  slug: z.string().min(1).max(200).trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(1000).trim().optional(),
  fields: z.array(fieldSchema).min(1, 'At least one field is required').max(50),
  isActive: z.boolean().optional().default(true),
});

const updateCollectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).trim().optional(),
  slug: z.string().min(1).max(200).trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  description: z.string().max(1000).trim().optional().nullable(),
  fields: z.array(fieldSchema).min(1).max(50).optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// GET: List collections
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;
  const search = searchParams.get('search');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.cmsCollection.findMany({
      where,
      take: limit,
      skip,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { items: true } },
      },
    }),
    prisma.cmsCollection.count({ where }),
  ]);

  return apiPaginated(data, page, limit, total, { request });
});

// ---------------------------------------------------------------------------
// POST: Create a collection
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = createCollectionSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Validation failed', 'VALIDATION_ERROR', { status: 400, details: parsed.error.flatten().fieldErrors });
  }

  // Check slug uniqueness
  const existing = await prisma.cmsCollection.findFirst({
    where: { slug: parsed.data.slug },
  });

  if (existing) {
    return apiError('A collection with this slug already exists', 'CONFLICT', { status: 409 });
  }

  const collection = await prisma.cmsCollection.create({
    data: {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      fields: JSON.parse(JSON.stringify(parsed.data.fields)),
      isActive: parsed.data.isActive,
    },
    include: {
      _count: { select: { items: true } },
    },
  });

  return apiSuccess(collection, { status: 201 });
});

// ---------------------------------------------------------------------------
// PUT: Update a collection
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = updateCollectionSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Validation failed', 'VALIDATION_ERROR', { status: 400, details: parsed.error.flatten().fieldErrors });
  }

  const { id, ...updateData } = parsed.data;

  // Verify collection exists
  const existing = await prisma.cmsCollection.findUnique({ where: { id } });
  if (!existing) {
    return apiError('Collection not found', 'NOT_FOUND', { status: 404 });
  }

  // Check slug uniqueness if changed
  if (updateData.slug && updateData.slug !== existing.slug) {
    const slugConflict = await prisma.cmsCollection.findFirst({
      where: { slug: updateData.slug, id: { not: id } },
    });
    if (slugConflict) {
      return apiError('A collection with this slug already exists', 'CONFLICT', { status: 409 });
    }
  }

  const collection = await prisma.cmsCollection.update({
    where: { id },
    data: {
      ...updateData,
      fields: updateData.fields ? JSON.parse(JSON.stringify(updateData.fields)) : undefined,
    },
    include: {
      _count: { select: { items: true } },
    },
  });

  return apiSuccess(collection);
});

// ---------------------------------------------------------------------------
// DELETE: Delete a collection
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return apiError('Missing collection id', 'VALIDATION_ERROR', { status: 400 });
  }

  const existing = await prisma.cmsCollection.findUnique({ where: { id } });
  if (!existing) {
    return apiError('Collection not found', 'NOT_FOUND', { status: 404 });
  }

  await prisma.cmsCollection.delete({ where: { id } });

  return apiSuccess({ deleted: true });
});

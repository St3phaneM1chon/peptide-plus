export const dynamic = 'force-dynamic';

/**
 * List Prospects API
 * GET    - List prospects in a list (filters, search, pagination)
 * POST   - Add prospects to a list (with auto-dedup)
 * DELETE - Bulk delete prospects by ids
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';
import { findProspectDuplicates, updateListCounters } from '@/lib/crm/prospect-dedup';

const addProspectSchema = z.object({
  prospects: z.array(z.object({
    contactName: z.string().min(1).max(200).trim(),
    companyName: z.string().max(200).trim().optional(),
    email: z.string().email().max(320).optional(),
    phone: z.string().max(50).trim().optional(),
    website: z.string().max(500).trim().optional(),
    address: z.string().max(500).trim().optional(),
    city: z.string().max(100).trim().optional(),
    province: z.string().max(100).trim().optional(),
    postalCode: z.string().max(20).trim().optional(),
    country: z.string().max(100).trim().optional(),
    industry: z.string().max(200).trim().optional(),
    notes: z.string().max(5000).trim().optional(),
    customFields: z.record(z.unknown()).optional(),
  })).min(1).max(500),
});

const deleteProspectsSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(500),
});

// GET: List prospects
export const GET = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id: listId } = await context.params;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  const status = searchParams.get('status');
  const search = searchParams.get('search');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { listId };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { contactName: { contains: search, mode: 'insensitive' } },
      { companyName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [prospects, total] = await Promise.all([
    prisma.prospect.findMany({
      where,
      include: {
        duplicateOf: { select: { id: true, contactName: true } },
        convertedLead: { select: { id: true, contactName: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.prospect.count({ where }),
  ]);

  return apiPaginated(prospects, page, limit, total, { request });
});

// POST: Add prospects (with dedup)
export const POST = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id: listId } = await context.params;
  const body = await request.json();
  const parsed = addProspectSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  // Verify list exists
  const list = await prisma.prospectList.findUnique({ where: { id: listId } });
  if (!list) {
    return apiError('List not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  let added = 0;
  let duplicates = 0;
  const errors: { index: number; contactName: string; reason: string }[] = [];

  for (let i = 0; i < parsed.data.prospects.length; i++) {
    const p = parsed.data.prospects[i];
    try {
      const prospect = await prisma.prospect.create({
        data: {
          listId,
          contactName: p.contactName,
          companyName: p.companyName || null,
          email: p.email?.toLowerCase() || null,
          phone: p.phone || null,
          website: p.website || null,
          address: p.address || null,
          city: p.city || null,
          province: p.province || null,
          postalCode: p.postalCode || null,
          country: p.country || null,
          industry: p.industry || null,
          notes: p.notes || null,
          customFields: p.customFields ? JSON.parse(JSON.stringify(p.customFields)) : undefined,
          status: 'NEW',
        },
      });

      // Check for duplicates within the list
      const dups = await findProspectDuplicates(prospect, listId);
      if (dups.length > 0 && dups[0].confidence >= 0.85) {
        await prisma.prospect.update({ where: { id: prospect.id }, data: { status: 'DUPLICATE', duplicateOfId: dups[0].matchedId } });
        duplicates++;
      }

      added++;
    } catch (err) {
      errors.push({ index: i, contactName: p.contactName, reason: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  await updateListCounters(listId);
  return apiSuccess({ added, duplicates, errors }, { status: 201, request });
});

// DELETE: Bulk delete
export const DELETE = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id: listId } = await context.params;
  const body = await request.json();
  const parsed = deleteProspectsSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', { status: 400, details: parsed.error.flatten(), request });
  }

  const result = await prisma.prospect.deleteMany({
    where: { id: { in: parsed.data.ids }, listId },
  });

  await updateListCounters(listId);
  return apiSuccess({ deleted: result.count }, { request });
});

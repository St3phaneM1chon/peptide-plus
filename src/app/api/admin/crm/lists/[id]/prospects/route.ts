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
import { findProspectDuplicatesBatch, updateListCounters } from '@/lib/crm/prospect-dedup';
import { logger } from '@/lib/logger';

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
}, { requiredPermission: 'crm.leads.view' });

// POST: Add prospects (with dedup)
export const POST = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id: listId } = await context.params;
  const body = await request.json();
  const parsed = addProspectSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', {
      status: 400,
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

  // Bulk insert all prospects using createManyAndReturn (Prisma 5.14+)
  const prospectsData = parsed.data.prospects.map((p, i) => ({
    index: i,
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
      status: 'NEW' as const,
    },
  }));

  // Create prospects one by one in a transaction for error isolation, but batch all dedup after
  const createdProspects: Array<{ id: string; email: string | null; phone: string | null; contactName: string; companyName: string | null; googlePlaceId: string | null }> = [];

  // Use transaction to batch all creates (single round-trip to DB)
  try {
    const results = await prisma.$transaction(
      prospectsData.map(p => prisma.prospect.create({
        data: p.data,
        select: { id: true, email: true, phone: true, contactName: true, companyName: true, googlePlaceId: true },
      }))
    );
    for (const r of results) {
      createdProspects.push(r);
      added++;
    }
  } catch (err) {
    logger.error('[CRM/Prospects] Bulk create transaction failed, falling back to individual creates', err);
    // If bulk transaction fails, fall back to individual creates for error isolation
    for (let i = 0; i < prospectsData.length; i++) {
      try {
        const result = await prisma.prospect.create({
          data: prospectsData[i].data,
          select: { id: true, email: true, phone: true, contactName: true, companyName: true, googlePlaceId: true },
        });
        createdProspects.push(result);
        added++;
      } catch (err) {
        logger.error('[CRM/Prospects] Individual prospect create failed:', err);
        errors.push({ index: i, contactName: prospectsData[i].data.contactName, reason: err instanceof Error ? err.message : 'Unknown error' });
      }
    }
  }

  // Batch duplicate detection: pre-fetch all existing prospects once (N+1 fix)
  // then run matching in-memory for all new prospects
  if (createdProspects.length > 0) {
    const dupUpdates: Array<{ id: string; duplicateOfId: string }> = [];

    const batchResults = await findProspectDuplicatesBatch(createdProspects, listId);
    for (const prospect of createdProspects) {
      const dups = batchResults.get(prospect.id) || [];
      if (dups.length > 0 && dups[0].confidence >= 0.85) {
        dupUpdates.push({ id: prospect.id, duplicateOfId: dups[0].matchedId });
      }
    }

    if (dupUpdates.length > 0) {
      await prisma.$transaction(
        dupUpdates.map(d => prisma.prospect.update({
          where: { id: d.id },
          data: { status: 'DUPLICATE', duplicateOfId: d.duplicateOfId },
        }))
      );
      duplicates = dupUpdates.length;
    }
  }

  await updateListCounters(listId);
  return apiSuccess({ added, duplicates, errors }, { status: 201, request });
}, { requiredPermission: 'crm.leads.edit' });

// DELETE: Bulk delete
export const DELETE = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id: listId } = await context.params;
  const body = await request.json();
  const parsed = deleteProspectsSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', { status: 400, request });
  }

  const result = await prisma.prospect.deleteMany({
    where: { id: { in: parsed.data.ids }, listId },
  });

  await updateListCounters(listId);
  return apiSuccess({ deleted: result.count }, { request });
}, { requiredPermission: 'crm.leads.edit' });

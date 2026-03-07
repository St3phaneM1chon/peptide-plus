export const dynamic = 'force-dynamic';

/**
 * Single Prospect API
 * GET    /api/admin/crm/lists/[id]/prospects/[prospectId]
 * PUT    /api/admin/crm/lists/[id]/prospects/[prospectId]
 * DELETE /api/admin/crm/lists/[id]/prospects/[prospectId]
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { updateListCounters } from '@/lib/crm/prospect-dedup';

const updateProspectSchema = z.object({
  contactName: z.string().min(1).max(200).trim().optional(),
  companyName: z.string().max(200).trim().nullable().optional(),
  email: z.string().email().max(320).nullable().optional(),
  phone: z.string().max(50).trim().nullable().optional(),
  website: z.string().max(500).trim().nullable().optional(),
  address: z.string().max(500).trim().nullable().optional(),
  city: z.string().max(100).trim().nullable().optional(),
  province: z.string().max(100).trim().nullable().optional(),
  postalCode: z.string().max(20).trim().nullable().optional(),
  country: z.string().max(100).trim().nullable().optional(),
  industry: z.string().max(200).trim().nullable().optional(),
  notes: z.string().max(5000).trim().nullable().optional(),
  customFields: z.record(z.unknown()).nullable().optional(),
  status: z.enum(['NEW', 'VALIDATED', 'DUPLICATE', 'EXCLUDED']).optional(),
});

// GET: Prospect detail
export const GET = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string; prospectId: string }> }) => {
  const { id: listId, prospectId } = await context.params;

  const prospect = await prisma.prospect.findFirst({
    where: { id: prospectId, listId },
    include: {
      duplicateOf: { select: { id: true, contactName: true, email: true, phone: true } },
      duplicates: { select: { id: true, contactName: true, email: true, phone: true, status: true } },
      convertedLead: { select: { id: true, contactName: true, status: true, assignedTo: { select: { name: true } } } },
    },
  });

  if (!prospect) {
    return apiError('Prospect not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  return apiSuccess(prospect, { request });
});

// PUT: Update prospect
export const PUT = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string; prospectId: string }> }) => {
  const { id: listId, prospectId } = await context.params;
  const body = await request.json();
  const parsed = updateProspectSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const existing = await prisma.prospect.findFirst({ where: { id: prospectId, listId } });
  if (!existing) {
    return apiError('Prospect not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  const { customFields, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (data.email) data.email = (data.email as string).toLowerCase();
  if (customFields !== undefined) {
    data.customFields = customFields ? JSON.parse(JSON.stringify(customFields)) : null;
  }

  const updated = await prisma.prospect.update({
    where: { id: prospectId },
    data,
  });

  await updateListCounters(listId);
  return apiSuccess(updated, { request });
});

// DELETE: Delete prospect
export const DELETE = withAdminGuard(async (request: NextRequest, context: { params: Promise<{ id: string; prospectId: string }> }) => {
  const { id: listId, prospectId } = await context.params;

  const existing = await prisma.prospect.findFirst({ where: { id: prospectId, listId } });
  if (!existing) {
    return apiError('Prospect not found', 'RESOURCE_NOT_FOUND', { status: 404, request });
  }

  await prisma.prospect.delete({ where: { id: prospectId } });
  await updateListCounters(listId);
  return apiSuccess({ deleted: true }, { request });
});

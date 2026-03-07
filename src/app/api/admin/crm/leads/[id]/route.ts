export const dynamic = 'force-dynamic';

/**
 * CRM Lead Item API
 * GET    /api/admin/crm/leads/[id] - Get single lead with relations
 * PUT    /api/admin/crm/leads/[id] - Update lead fields
 * DELETE /api/admin/crm/leads/[id] - Delete a lead
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const updateLeadSchema = z.object({
  contactName: z.string().min(1).max(200).trim().optional(),
  companyName: z.string().max(200).trim().nullable().optional(),
  email: z.string().email().max(320).nullable().optional(),
  phone: z.string().max(50).trim().nullable().optional(),
  source: z.enum(['WEB', 'REFERRAL', 'IMPORT', 'CAMPAIGN', 'MANUAL', 'PARTNER']).optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST']).optional(),
  score: z.number().int().min(0).max(100).optional(),
  temperature: z.enum(['HOT', 'WARM', 'COLD']).optional(),
  assignedToId: z.string().cuid().nullable().optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  customFields: z.record(z.unknown()).nullable().optional(),
  lastContactedAt: z.string().datetime().nullable().optional(),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
  dncStatus: z.enum(['CALLABLE', 'INTERNAL_DNC', 'NATIONAL_DNC']).optional(),
  timezone: z.string().max(100).nullable().optional(),
  preferredLang: z.string().max(10).nullable().optional(),
});

// ---------------------------------------------------------------------------
// GET: Single lead with all relations
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const lead = await prisma.crmLead.findUnique({
    where: { id },
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      deals: {
        include: { stage: { select: { name: true, color: true } } },
      },
      tasks: {
        orderBy: { createdAt: 'desc' },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        include: {
          performedBy: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!lead) {
    return apiError('Lead not found', 'RESOURCE_NOT_FOUND', {
      status: 404,
      request,
    });
  }

  return apiSuccess(lead, { request });
});

// ---------------------------------------------------------------------------
// PUT: Update lead
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const existing = await prisma.crmLead.findUnique({ where: { id } });
  if (!existing) {
    return apiError('Lead not found', 'RESOURCE_NOT_FOUND', {
      status: 404,
      request,
    });
  }

  const body = await request.json();
  const parsed = updateLeadSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const data = parsed.data;

  // Validate assignedToId if provided and not null
  if (data.assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: data.assignedToId },
      select: { id: true },
    });
    if (!assignee) {
      return apiError('Assigned user not found', 'RESOURCE_NOT_FOUND', {
        status: 404,
        request,
      });
    }
  }

  // Build update payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};
  if (data.contactName !== undefined) updateData.contactName = data.contactName;
  if (data.companyName !== undefined) updateData.companyName = data.companyName;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.source !== undefined) updateData.source = data.source;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.score !== undefined) updateData.score = data.score;
  if (data.temperature !== undefined) updateData.temperature = data.temperature;
  if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId;
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.customFields !== undefined) updateData.customFields = data.customFields;
  if (data.lastContactedAt !== undefined) {
    updateData.lastContactedAt = data.lastContactedAt ? new Date(data.lastContactedAt) : null;
  }
  if (data.nextFollowUpAt !== undefined) {
    updateData.nextFollowUpAt = data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null;
  }
  if (data.dncStatus !== undefined) updateData.dncStatus = data.dncStatus;
  if (data.timezone !== undefined) updateData.timezone = data.timezone;
  if (data.preferredLang !== undefined) updateData.preferredLang = data.preferredLang;

  const lead = await prisma.crmLead.update({
    where: { id },
    data: updateData,
    include: {
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return apiSuccess(lead, { request });
});

// ---------------------------------------------------------------------------
// DELETE: Delete a lead
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const existing = await prisma.crmLead.findUnique({ where: { id } });
  if (!existing) {
    return apiError('Lead not found', 'RESOURCE_NOT_FOUND', {
      status: 404,
      request,
    });
  }

  await prisma.crmLead.delete({ where: { id } });

  return apiSuccess({ deleted: true }, { request });
});

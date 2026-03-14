export const dynamic = 'force-dynamic';

/**
 * CRM Lead Conversion API
 * POST /api/admin/crm/leads/[id]/convert - Convert a lead into a deal
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const convertLeadSchema = z.object({
  title: z.string().min(1, 'Deal title is required').max(300).trim(),
  value: z.number().min(0).optional(),
  pipelineId: z.string().cuid('Invalid pipeline ID'),
  stageId: z.string().cuid('Invalid stage ID'),
  assignedToId: z.string().cuid().optional(),
});

// ---------------------------------------------------------------------------
// POST: Convert lead to deal
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (
  request: NextRequest,
  { session, params }: { session: { user: { id: string } }; params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  // Verify lead exists and is not already converted
  const lead = await prisma.crmLead.findUnique({ where: { id } });
  if (!lead) {
    return apiError('Lead not found', 'RESOURCE_NOT_FOUND', {
      status: 404,
      request,
    });
  }

  if (lead.status === 'CONVERTED') {
    return apiError('Lead is already converted', 'CONFLICT', {
      status: 409,
      request,
    });
  }

  const body = await request.json();
  const parsed = convertLeadSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const { title, value, pipelineId, stageId, assignedToId } = parsed.data;

  // Resolve assigned user: explicit > lead assignee > current user
  const resolvedAssignedToId = assignedToId || lead.assignedToId || session.user.id;

  // Validate pipeline, stage, and assignee in parallel
  const [pipeline, stage, assignee] = await Promise.all([
    prisma.crmPipeline.findUnique({
      where: { id: pipelineId },
      select: { id: true },
    }),
    prisma.crmPipelineStage.findFirst({
      where: { id: stageId, pipelineId },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: resolvedAssignedToId },
      select: { id: true },
    }),
  ]);

  if (!pipeline) {
    return apiError('Pipeline not found', 'RESOURCE_NOT_FOUND', {
      status: 404,
      request,
    });
  }
  if (!stage) {
    return apiError('Stage not found in the specified pipeline', 'RESOURCE_NOT_FOUND', {
      status: 404,
      request,
    });
  }
  if (!assignee) {
    return apiError('Assigned user not found', 'RESOURCE_NOT_FOUND', {
      status: 404,
      request,
    });
  }

  // Transaction: create deal + update lead + create activities
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the deal
    const deal = await tx.crmDeal.create({
      data: {
        title,
        value: value ?? 0,
        pipelineId,
        stageId,
        leadId: id,
        assignedToId: resolvedAssignedToId,
      },
    });

    // 2. Update lead status and link to converted deal
    const updatedLead = await tx.crmLead.update({
      where: { id },
      data: {
        status: 'CONVERTED',
        convertedDealId: deal.id,
      },
    });

    // 3. Create activity on the lead
    await tx.crmActivity.create({
      data: {
        type: 'STATUS_CHANGE',
        title: 'Lead converted to deal',
        description: `Lead "${lead.contactName}" was converted to deal "${title}"`,
        leadId: id,
        performedById: session.user.id,
        metadata: { dealId: deal.id, dealTitle: title },
      },
    });

    // 4. Create activity on the deal
    await tx.crmActivity.create({
      data: {
        type: 'DEAL_CREATED',
        title: 'Deal created from lead conversion',
        description: `Deal created from lead "${lead.contactName}"`,
        dealId: deal.id,
        performedById: session.user.id,
        metadata: { leadId: id, leadName: lead.contactName },
      },
    });

    return { deal, lead: updatedLead };
  });

  return apiSuccess(result, { status: 201, request });
}, { requiredPermission: 'crm.leads.edit' });

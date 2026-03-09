export const dynamic = 'force-dynamic';

/**
 * CRM Deals API
 * GET  /api/admin/crm/deals -- List deals with filters, paginated
 * POST /api/admin/crm/deals -- Create a new deal + DEAL_CREATED activity
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createDealSchema = z.object({
  title: z.string().min(1).max(300),
  stageId: z.string().min(1),
  pipelineId: z.string().min(1),
  assignedToId: z.string().min(1),
  value: z.union([z.string(), z.number()]).optional(),
  currency: z.string().max(10).default('CAD'),
  leadId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  tags: z.array(z.string()).default([]),
  customFields: z.record(z.unknown()).optional().nullable(),
});

// ---------------------------------------------------------------------------
// GET: List deals (paginated, filtered)
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    // Filters
    const stageId = searchParams.get('stageId');
    const pipelineId = searchParams.get('pipelineId');
    const assignedToId = searchParams.get('assignedToId');
    const minValue = searchParams.get('minValue');
    const maxValue = searchParams.get('maxValue');
    const tagsParam = searchParams.get('tags'); // comma-separated
    const search = searchParams.get('search');

    const where: Prisma.CrmDealWhereInput = {};

    if (stageId) where.stageId = stageId;
    if (pipelineId) where.pipelineId = pipelineId;
    if (assignedToId) where.assignedToId = assignedToId;

    if (minValue || maxValue) {
      where.value = {};
      if (minValue) where.value.gte = new Prisma.Decimal(minValue);
      if (maxValue) where.value.lte = new Prisma.Decimal(maxValue);
    }

    if (tagsParam) {
      const tags = tagsParam.split(',').map(t => t.trim()).filter(Boolean);
      if (tags.length > 0) {
        where.tags = { hasSome: tags };
      }
    }

    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    const [deals, total] = await Promise.all([
      prisma.crmDeal.findMany({
        where,
        include: {
          stage: { select: { id: true, name: true, color: true, probability: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          lead: { select: { id: true, contactName: true } },
          contact: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.crmDeal.count({ where }),
    ]);

    return apiPaginated(deals, page, limit, total, { request });
  } catch (error) {
    logger.error('[crm/deals] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch deals', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.deals.view' });

// ---------------------------------------------------------------------------
// POST: Create a new deal
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (
  request: NextRequest,
  { session }: { session: { user: { id: string } } }
) => {
  try {
    const body = await request.json();
    const parsed = createDealSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        request,
        details: parsed.error.flatten(),
      });
    }

    const {
      title, stageId, pipelineId, assignedToId,
      value, currency, leadId, contactId,
      expectedCloseDate, tags, customFields,
    } = parsed.data;

    // Verify stage exists and belongs to the pipeline
    const stage = await prisma.crmPipelineStage.findFirst({
      where: { id: stageId, pipelineId },
    });

    if (!stage) {
      return apiError('Stage not found or does not belong to the specified pipeline', ErrorCode.NOT_FOUND, { request });
    }

    // Verify assignee exists
    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { id: true },
    });

    if (!assignee) {
      return apiError('Assigned user not found', ErrorCode.NOT_FOUND, { request });
    }

    // Create deal + initial activity in a transaction
    const deal = await prisma.$transaction(async (tx) => {
      const newDeal = await tx.crmDeal.create({
        data: {
          title,
          value: value !== undefined ? new Prisma.Decimal(String(value)) : new Prisma.Decimal(0),
          currency,
          stageId,
          pipelineId,
          assignedToId,
          leadId: leadId || null,
          contactId: contactId || null,
          expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
          tags,
          customFields: customFields ? JSON.parse(JSON.stringify(customFields)) : Prisma.JsonNull,
        },
        include: {
          stage: { select: { id: true, name: true, color: true, probability: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          lead: { select: { id: true, contactName: true } },
          contact: { select: { id: true, name: true, email: true } },
        },
      });

      // Create DEAL_CREATED activity
      await tx.crmActivity.create({
        data: {
          type: 'DEAL_CREATED',
          title: 'Deal created',
          dealId: newDeal.id,
          performedById: session.user.id,
          metadata: { dealTitle: title, value: String(value ?? 0) },
        },
      });

      // Create initial stage history entry
      await tx.crmDealStageHistory.create({
        data: {
          dealId: newDeal.id,
          toStageId: stageId,
          changedById: session.user.id,
          duration: 0,
        },
      });

      return newDeal;
    });

    logger.info('[crm/deals] Deal created', {
      dealId: deal.id,
      title: deal.title,
      pipelineId,
      stageId,
      createdBy: session.user.id,
    });

    return apiSuccess(deal, { status: 201, request });
  } catch (error) {
    logger.error('[crm/deals] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to create deal', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.deals.create' });

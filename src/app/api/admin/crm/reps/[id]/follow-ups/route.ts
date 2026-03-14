export const dynamic = 'force-dynamic';

/**
 * Sales Rep 360° Dashboard - Follow-Ups CRUD
 * GET   /api/admin/crm/reps/[id]/follow-ups       - List follow-ups for agent
 * POST  /api/admin/crm/reps/[id]/follow-ups       - Create a follow-up (+ optional series)
 * PATCH /api/admin/crm/reps/[id]/follow-ups?followUpId=... - Update a follow-up
 */

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiPaginated, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const createFollowUpSchema = z.object({
  leadId: z.string().min(1).optional(),
  dealId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  type: z.enum(['RETENTION', 'UPSELL', 'RENEWAL', 'CHECK_IN', 'ANNIVERSARY']),
  intervalMonths: z.number().int().min(1),
  scheduledDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'scheduledDate must be a valid ISO date string',
  }),
  notes: z.string().optional(),
});

const updateFollowUpSchema = z.object({
  status: z.enum(['PENDING', 'COMPLETED', 'OVERDUE', 'SKIPPED', 'RESCHEDULED']).optional(),
  completedDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'completedDate must be a valid ISO date string',
  }).optional(),
  notes: z.string().optional(),
  outcome: z.string().optional(),
  nextAction: z.string().optional(),
  scheduledDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'scheduledDate must be a valid ISO date string',
  }).optional(),
});

// ---------------------------------------------------------------------------
// GET: List follow-ups for an agent
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest, { session, params }: { session: { user: { id: string; role: string } }; params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { searchParams } = new URL(request.url);

  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  try {
    // Verify the agent exists
    const agent = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!agent) {
      return apiError('Agent not found', ErrorCode.NOT_FOUND, { status: 404, request });
    }

    // Build where clause
    const where: Prisma.RepFollowUpScheduleWhereInput = { agentId: id };

    if (status) {
      where.status = status as Prisma.EnumFollowUpStatusFilter;
    }

    if (type) {
      where.type = type as Prisma.EnumFollowUpTypeFilter;
    }

    if (dateFrom || dateTo) {
      where.scheduledDate = {};
      if (dateFrom) where.scheduledDate.gte = new Date(dateFrom);
      if (dateTo) where.scheduledDate.lte = new Date(dateTo);
    }

    const [followUps, total] = await Promise.all([
      prisma.repFollowUpSchedule.findMany({
        where,
        include: {
          lead: { select: { id: true, contactName: true } },
          deal: { select: { id: true, title: true, value: true } },
          customer: { select: { id: true, name: true, email: true } },
        },
        orderBy: { scheduledDate: 'asc' },
        skip,
        take: limit,
      }),
      prisma.repFollowUpSchedule.count({ where }),
    ]);

    return apiPaginated(followUps, page, limit, total, { request });
  } catch (error) {
    logger.error('Failed to list follow-ups', {
      event: 'rep_followups_list_error',
      agentId: id,
      error: error instanceof Error ? error.message : String(error),
      userId: session.user?.id,
    });
    return apiError('Failed to list follow-ups', ErrorCode.INTERNAL_ERROR, {
      status: 500,
      request,
    });
  }
}, { requiredPermission: 'crm.reports.view' });

// ---------------------------------------------------------------------------
// POST: Create a follow-up (optionally generate a series)
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session, params }: { session: { user: { id: string; role: string } }; params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const generateSeries = searchParams.get('generateFollowUpSeries') === 'true';

  try {
    const body = await request.json();
    const parsed = createFollowUpSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        status: 400,
        details: parsed.error.flatten(),
        request,
      });
    }

    const { leadId, dealId, customerId, type, intervalMonths, scheduledDate, notes } = parsed.data;

    // Verify the agent exists
    const agent = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!agent) {
      return apiError('Agent not found', ErrorCode.NOT_FOUND, { status: 404, request });
    }

    // Create the primary follow-up
    const primaryFollowUp = await prisma.repFollowUpSchedule.create({
      data: {
        agentId: id,
        leadId: leadId || null,
        dealId: dealId || null,
        customerId: customerId || null,
        type,
        intervalMonths,
        scheduledDate: new Date(scheduledDate),
        notes: notes || null,
        status: 'PENDING',
      },
      include: {
        lead: { select: { id: true, contactName: true } },
        deal: { select: { id: true, title: true, value: true } },
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    const createdFollowUps = [primaryFollowUp];

    // Auto-generate subsequent follow-ups in the series
    // e.g., if intervalMonths=3, generate 6, 12, 18, 24 month follow-ups
    // N+1 fix: use Promise.all instead of sequential creates in a loop
    if (generateSeries) {
      const seriesIntervals = [6, 12, 18, 24].filter((m) => m > intervalMonths);

      const seriesFollowUps = await Promise.all(
        seriesIntervals.map((interval) => {
          const baseDate = new Date(scheduledDate);
          const monthsDiff = interval - intervalMonths;
          const seriesDate = new Date(baseDate);
          seriesDate.setMonth(seriesDate.getMonth() + monthsDiff);

          return prisma.repFollowUpSchedule.create({
            data: {
              agentId: id,
              leadId: leadId || null,
              dealId: dealId || null,
              customerId: customerId || null,
              type,
              intervalMonths: interval,
              scheduledDate: seriesDate,
              notes: notes ? `${notes} (auto-generated ${interval}-month follow-up)` : `Auto-generated ${interval}-month follow-up`,
              status: 'PENDING',
            },
            include: {
              lead: { select: { id: true, contactName: true } },
              deal: { select: { id: true, title: true, value: true } },
              customer: { select: { id: true, name: true, email: true } },
            },
          });
        })
      );

      createdFollowUps.push(...seriesFollowUps);
    }

    logger.info('Follow-up(s) created', {
      event: 'rep_followup_created',
      agentId: id,
      count: createdFollowUps.length,
      type,
      intervalMonths,
      generateSeries,
      createdBy: session.user?.id,
    });

    return apiSuccess(
      { followUps: createdFollowUps, count: createdFollowUps.length },
      { status: 201, request },
    );
  } catch (error) {
    logger.error('Failed to create follow-up', {
      event: 'rep_followup_create_error',
      agentId: id,
      error: error instanceof Error ? error.message : String(error),
      userId: session.user?.id,
    });
    return apiError('Failed to create follow-up', ErrorCode.INTERNAL_ERROR, {
      status: 500,
      request,
    });
  }
}, { requiredPermission: 'crm.reports.edit' });

// ---------------------------------------------------------------------------
// PATCH: Update a follow-up
// ---------------------------------------------------------------------------

export const PATCH = withAdminGuard(async (request: NextRequest, { session, params }: { session: { user: { id: string; role: string } }; params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const followUpId = searchParams.get('followUpId');

  if (!followUpId) {
    return apiError('followUpId query parameter is required', ErrorCode.VALIDATION_ERROR, {
      status: 400,
      request,
    });
  }

  try {
    const body = await request.json();
    const parsed = updateFollowUpSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        status: 400,
        details: parsed.error.flatten(),
        request,
      });
    }

    // Verify the follow-up exists and belongs to this agent
    const existing = await prisma.repFollowUpSchedule.findUnique({
      where: { id: followUpId },
      select: { id: true, agentId: true },
    });

    if (!existing) {
      return apiError('Follow-up not found', ErrorCode.NOT_FOUND, { status: 404, request });
    }

    if (existing.agentId !== id) {
      return apiError('Follow-up does not belong to this agent', ErrorCode.FORBIDDEN, {
        status: 403,
        request,
      });
    }

    // Build update data
    const updateData: Prisma.RepFollowUpScheduleUpdateInput = {};

    if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status;

      // Auto-set completedDate when marking as COMPLETED
      if (parsed.data.status === 'COMPLETED' && !parsed.data.completedDate) {
        updateData.completedDate = new Date();
      }
    }

    if (parsed.data.completedDate !== undefined) {
      updateData.completedDate = new Date(parsed.data.completedDate);
    }

    if (parsed.data.notes !== undefined) {
      updateData.notes = parsed.data.notes;
    }

    if (parsed.data.outcome !== undefined) {
      updateData.outcome = parsed.data.outcome;
    }

    if (parsed.data.nextAction !== undefined) {
      updateData.nextAction = parsed.data.nextAction;
    }

    if (parsed.data.scheduledDate !== undefined) {
      updateData.scheduledDate = new Date(parsed.data.scheduledDate);
    }

    const updated = await prisma.repFollowUpSchedule.update({
      where: { id: followUpId },
      data: updateData,
      include: {
        lead: { select: { id: true, contactName: true } },
        deal: { select: { id: true, title: true, value: true } },
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    logger.info('Follow-up updated', {
      event: 'rep_followup_updated',
      followUpId,
      agentId: id,
      changes: Object.keys(updateData),
      updatedBy: session.user?.id,
    });

    return apiSuccess(updated, { request });
  } catch (error) {
    logger.error('Failed to update follow-up', {
      event: 'rep_followup_update_error',
      followUpId,
      agentId: id,
      error: error instanceof Error ? error.message : String(error),
      userId: session.user?.id,
    });
    return apiError('Failed to update follow-up', ErrorCode.INTERNAL_ERROR, {
      status: 500,
      request,
    });
  }
}, { requiredPermission: 'crm.reports.edit' });

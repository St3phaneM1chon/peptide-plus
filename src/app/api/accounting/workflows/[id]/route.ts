export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError, apiNoContent } from '@/lib/api-response';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'contains']),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
});

const actionSchema = z.object({
  type: z.enum(['REQUIRE_APPROVAL', 'SEND_NOTIFICATION', 'AUTO_APPROVE', 'BLOCK']),
  params: z
    .object({
      role: z.string().optional(),
      userId: z.string().optional(),
      message: z.string().optional(),
      expiresInDays: z.number().int().positive().optional(),
    })
    .optional(),
});

const updateWorkflowRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  entityType: z
    .enum([
      'JOURNAL_ENTRY',
      'EXPENSE',
      'PURCHASE_ORDER',
      'INVOICE',
      'CREDIT_NOTE',
      'PAYROLL_RUN',
      'TIME_ENTRY',
    ])
    .optional(),
  triggerEvent: z.enum(['CREATE', 'UPDATE', 'STATUS_CHANGE', 'AMOUNT_THRESHOLD']).optional(),
  conditions: z.array(conditionSchema).optional(),
  actions: z.array(actionSchema).min(1).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/workflows/[id] - Get single rule
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest, { params }) => {
  try {
    const { id } = params;

    const rule = await prisma.workflowRule.findUnique({
      where: { id },
    });

    if (!rule || rule.deletedAt) {
      return apiError('Workflow rule not found', 'NOT_FOUND', { status: 404, request });
    }

    return apiSuccess(
      {
        ...rule,
        conditions: JSON.parse(rule.conditions),
        actions: JSON.parse(rule.actions),
      },
      { request },
    );
  } catch (error) {
    logger.error('Error fetching workflow rule', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Error fetching workflow rule', 'INTERNAL_ERROR', { status: 500, request });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/accounting/workflows/[id] - Update rule
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request: NextRequest, { params, session }) => {
  try {
    const { id } = params;

    const existing = await prisma.workflowRule.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return apiError('Workflow rule not found', 'NOT_FOUND', { status: 404, request });
    }

    const body = await request.json();
    const parsed = updateWorkflowRuleSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid data', 'VALIDATION_ERROR', {
        status: 400,
        details: parsed.error.flatten().fieldErrors,
        request,
      });
    }

    const data = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.entityType !== undefined) updateData.entityType = data.entityType;
    if (data.triggerEvent !== undefined) updateData.triggerEvent = data.triggerEvent;
    if (data.conditions !== undefined) updateData.conditions = JSON.stringify(data.conditions);
    if (data.actions !== undefined) updateData.actions = JSON.stringify(data.actions);
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updated = await prisma.workflowRule.update({
      where: { id },
      data: updateData,
    });

    logger.info('Workflow rule updated', {
      ruleId: id,
      updatedBy: session.user?.email,
      changes: Object.keys(updateData),
    });

    return apiSuccess(
      {
        ...updated,
        conditions: JSON.parse(updated.conditions),
        actions: JSON.parse(updated.actions),
      },
      { request },
    );
  } catch (error) {
    logger.error('Error updating workflow rule', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Error updating workflow rule', 'INTERNAL_ERROR', { status: 500, request });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/accounting/workflows/[id] - Soft-delete rule
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (request: NextRequest, { params, session }) => {
  try {
    const { id } = params;

    const existing = await prisma.workflowRule.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return apiError('Workflow rule not found', 'NOT_FOUND', { status: 404, request });
    }

    await prisma.workflowRule.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    logger.info('Workflow rule soft-deleted', {
      ruleId: id,
      deletedBy: session.user?.email,
    });

    return apiNoContent({ request });
  } catch (error) {
    logger.error('Error deleting workflow rule', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Error deleting workflow rule', 'INTERNAL_ERROR', { status: 500, request });
  }
});

export const dynamic = 'force-dynamic';

/**
 * CRM Workflow Automation API
 * GET  /api/admin/crm/workflows - List all workflows (optionally filtered by status)
 * POST /api/admin/crm/workflows - Create a new workflow with optional steps
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const workflowStepSchema = z.object({
  actionType: z.enum([
    'SEND_EMAIL',
    'SEND_SMS',
    'CREATE_TASK',
    'UPDATE_FIELD',
    'NOTIFY_AGENT',
    'WEBHOOK',
    'ASSIGN_TO',
    'MOVE_STAGE',
    'ADD_TAG',
    'REMOVE_TAG',
    'WAIT',
  ]),
  config: z.record(z.unknown()).default({}),
  delayMinutes: z.number().int().min(0).default(0),
  conditionJson: z.record(z.unknown()).optional().nullable(),
});

const createWorkflowSchema = z.object({
  name: z.string().min(1, 'Name is required').max(300).trim(),
  description: z.string().max(1000).optional().nullable(),
  triggerType: z.enum([
    'DEAL_STAGE_CHANGE',
    'LEAD_STATUS_CHANGE',
    'LEAD_SCORE_THRESHOLD',
    'NEW_LEAD',
    'NEW_DEAL',
    'TIME_BASED',
    'MANUAL',
    'FORM_SUBMISSION',
  ]),
  triggerConfig: z.record(z.unknown()).default({}),
  steps: z.array(workflowStepSchema).optional(),
});

// ---------------------------------------------------------------------------
// GET: List workflows
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const validStatuses = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'];
    const whereStatus =
      status && validStatuses.includes(status)
        ? (status as 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED')
        : undefined;

    const workflows = await prisma.crmWorkflow.findMany({
      where: whereStatus ? { status: whereStatus } : undefined,
      include: {
        steps: { orderBy: { position: 'asc' } },
        _count: { select: { executions: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return apiSuccess(workflows, { request });
  } catch (error) {
    logger.error('[crm/workflows] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch workflows', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.workflows.manage' });

// ---------------------------------------------------------------------------
// POST: Create a workflow
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const parsed = createWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        status: 400,
        details: parsed.error.flatten(),
        request,
      });
    }

    const { name, description, triggerType, triggerConfig, steps } = parsed.data;

    const workflow = await prisma.crmWorkflow.create({
      data: {
        name,
        description,
        triggerType,
        triggerConfig: (triggerConfig ?? {}) as Prisma.InputJsonValue,
        createdById: session.user.id,
        steps: steps && steps.length > 0
          ? {
              create: steps.map((s, i) => ({
                position: i,
                actionType: s.actionType,
                config: (s.config ?? {}) as Prisma.InputJsonValue,
                delayMinutes: s.delayMinutes ?? 0,
                conditionJson: s.conditionJson ? (s.conditionJson as Prisma.InputJsonValue) : Prisma.JsonNull,
              })) as Prisma.CrmWorkflowStepCreateWithoutWorkflowInput[],
            }
          : undefined,
      },
      include: {
        steps: { orderBy: { position: 'asc' } },
        _count: { select: { executions: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    logger.info('[crm/workflows] Workflow created', {
      workflowId: workflow.id,
      name,
      triggerType,
      stepCount: steps?.length ?? 0,
      createdById: session.user.id,
    });

    return apiSuccess(workflow, { request, status: 201 });
  } catch (error) {
    logger.error('[crm/workflows] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to create workflow', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.workflows.manage' });

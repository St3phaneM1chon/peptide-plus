export const dynamic = 'force-dynamic';

/**
 * CRM Workflow Versions API (I16)
 * GET  /api/admin/crm/workflow-versions?workflowId=... - List versions for a workflow
 * POST /api/admin/crm/workflow-versions - Create a version snapshot of current workflow
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

const createVersionSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  notes: z.string().max(500).optional().nullable(),
});

// ---------------------------------------------------------------------------
// GET: List versions for a workflow
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId');

    if (!workflowId) {
      return apiError('workflowId query parameter is required', ErrorCode.VALIDATION_ERROR, {
        status: 400,
        request,
      });
    }

    // Verify workflow exists
    const workflow = await prisma.crmWorkflow.findUnique({
      where: { id: workflowId },
      select: { id: true, name: true },
    });

    if (!workflow) {
      return apiError('Workflow not found', ErrorCode.RESOURCE_NOT_FOUND, {
        status: 404,
        request,
      });
    }

    const versions = await prisma.crmWorkflowVersion.findMany({
      where: { workflowId },
      orderBy: { version: 'desc' },
    });

    return apiSuccess(versions, { request });
  } catch (error) {
    logger.error('[crm/workflow-versions] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch workflow versions', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.workflows.manage' });

// ---------------------------------------------------------------------------
// POST: Create a version snapshot
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const parsed = createVersionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        status: 400,
        details: parsed.error.flatten(),
        request,
      });
    }

    const { workflowId, notes } = parsed.data;

    // Fetch current workflow with steps
    const workflow = await prisma.crmWorkflow.findUnique({
      where: { id: workflowId },
      include: { steps: { orderBy: { position: 'asc' } } },
    });

    if (!workflow) {
      return apiError('Workflow not found', ErrorCode.RESOURCE_NOT_FOUND, {
        status: 404,
        request,
      });
    }

    // Determine next version number
    const latestVersion = await prisma.crmWorkflowVersion.findFirst({
      where: { workflowId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const nextVersion = (latestVersion?.version ?? 0) + 1;

    // Snapshot steps as JSON
    const stepsSnapshot = workflow.steps.map(s => ({
      position: s.position,
      actionType: s.actionType,
      config: s.config,
      delayMinutes: s.delayMinutes,
      conditionJson: s.conditionJson,
    }));

    const version = await prisma.crmWorkflowVersion.create({
      data: {
        workflowId,
        version: nextVersion,
        triggerType: workflow.triggerType,
        triggerConfig: (workflow.triggerConfig ?? {}) as Prisma.InputJsonValue,
        steps: stepsSnapshot as unknown as Prisma.InputJsonValue,
        notes: notes || null,
        createdById: session.user.id,
      },
    });

    logger.info('[crm/workflow-versions] Version created', {
      workflowId,
      version: nextVersion,
      createdById: session.user.id,
    });

    return apiSuccess(version, { request, status: 201 });
  } catch (error) {
    logger.error('[crm/workflow-versions] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to create workflow version', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.workflows.manage' });

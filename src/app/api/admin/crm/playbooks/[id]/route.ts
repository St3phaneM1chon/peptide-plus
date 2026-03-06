export const dynamic = 'force-dynamic';

/**
 * CRM Playbook Detail API
 * GET    /api/admin/crm/playbooks/[id] - Get a playbook
 * PUT    /api/admin/crm/playbooks/[id] - Update a playbook
 * DELETE /api/admin/crm/playbooks/[id] - Delete a playbook
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const stageGuidanceSchema = z.object({
  stageId: z.string(),
  guidance: z.string(),
  checklist: z.array(z.string()),
  resources: z.array(z.object({ title: z.string(), url: z.string() })),
});

const updatePlaybookSchema = z.object({
  name: z.string().min(1).max(300).trim().optional(),
  description: z.string().max(5000).trim().nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  targetPipeline: z.string().nullable().optional(),
  stages: z.array(stageGuidanceSchema).optional(),
});

// ---------------------------------------------------------------------------
// GET: Get a playbook by ID
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    const playbook = await prisma.crmPlaybook.findUnique({ where: { id } });
    if (!playbook) {
      return apiError('Playbook not found', ErrorCode.NOT_FOUND, { status: 404, request });
    }

    return apiSuccess(playbook, { request });
  } catch (error) {
    logger.error('[crm/playbooks/[id]] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch playbook', ErrorCode.INTERNAL_ERROR, { request });
  }
});

// ---------------------------------------------------------------------------
// PUT: Update a playbook
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (
  request: NextRequest,
  { session, params }: { session: { user: { id: string } }; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updatePlaybookSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        status: 400,
        details: parsed.error.flatten(),
        request,
      });
    }

    const existing = await prisma.crmPlaybook.findUnique({ where: { id } });
    if (!existing) {
      return apiError('Playbook not found', ErrorCode.NOT_FOUND, { status: 404, request });
    }

    const data = parsed.data;

    const playbook = await prisma.crmPlaybook.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.targetPipeline !== undefined && { targetPipeline: data.targetPipeline }),
        ...(data.stages !== undefined && { stages: JSON.parse(JSON.stringify(data.stages)) }),
      },
    });

    logger.info('Playbook updated', {
      event: 'playbook_updated',
      playbookId: playbook.id,
      userId: session.user.id,
    });

    return apiSuccess(playbook, { request });
  } catch (error) {
    logger.error('[crm/playbooks/[id]] PUT error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to update playbook', ErrorCode.INTERNAL_ERROR, { request });
  }
});

// ---------------------------------------------------------------------------
// DELETE: Delete a playbook
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (
  request: NextRequest,
  { session, params }: { session: { user: { id: string } }; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    const existing = await prisma.crmPlaybook.findUnique({ where: { id } });
    if (!existing) {
      return apiError('Playbook not found', ErrorCode.NOT_FOUND, { status: 404, request });
    }

    await prisma.crmPlaybook.delete({ where: { id } });

    logger.info('Playbook deleted', {
      event: 'playbook_deleted',
      playbookId: id,
      userId: session.user.id,
    });

    return apiSuccess({ deleted: true }, { request });
  } catch (error) {
    logger.error('[crm/playbooks/[id]] DELETE error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to delete playbook', ErrorCode.INTERNAL_ERROR, { request });
  }
});

export const dynamic = 'force-dynamic';

/**
 * CRM Playbooks API
 * GET  /api/admin/crm/playbooks - List playbooks
 * POST /api/admin/crm/playbooks - Create a playbook
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

const createPlaybookSchema = z.object({
  name: z.string().min(1).max(300).trim(),
  description: z.string().max(5000).trim().nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT'),
  targetPipeline: z.string().nullable().optional(),
  stages: z.array(stageGuidanceSchema).default([]),
});

// ---------------------------------------------------------------------------
// GET: List playbooks
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (status) where.status = status;

    const playbooks = await prisma.crmPlaybook.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    return apiSuccess(playbooks, { request });
  } catch (error) {
    logger.error('[crm/playbooks] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch playbooks', ErrorCode.INTERNAL_ERROR, { request });
  }
});

// ---------------------------------------------------------------------------
// POST: Create a playbook
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const parsed = createPlaybookSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        status: 400,
        details: parsed.error.flatten(),
        request,
      });
    }

    const data = parsed.data;

    const playbook = await prisma.crmPlaybook.create({
      data: {
        name: data.name,
        description: data.description || null,
        status: data.status,
        targetPipeline: data.targetPipeline || null,
        stages: JSON.parse(JSON.stringify(data.stages)),
        createdById: session.user.id,
      },
    });

    logger.info('Playbook created', {
      event: 'playbook_created',
      playbookId: playbook.id,
      userId: session.user.id,
    });

    return apiSuccess(playbook, { status: 201, request });
  } catch (error) {
    logger.error('[crm/playbooks] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to create playbook', ErrorCode.INTERNAL_ERROR, { request });
  }
});

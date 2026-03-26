export const dynamic = 'force-dynamic';

/**
 * CRM Pipelines API
 * GET  /api/admin/crm/pipelines — List all pipelines with their stages
 * POST /api/admin/crm/pipelines — Create a new pipeline with stages
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

const stageInputSchema = z.object({
  name: z.string().min(1).max(100),
  position: z.number().int().min(0),
  probability: z.number().min(0).max(1).default(0),
  color: z.string().max(30).nullable().optional(),
  isWon: z.boolean().default(false),
  isLost: z.boolean().default(false),
});

const createPipelineSchema = z.object({
  name: z.string().min(1).max(200),
  isDefault: z.boolean().default(false),
  stages: z.array(stageInputSchema).min(1, 'At least one stage is required'),
});

// ---------------------------------------------------------------------------
// GET: List all pipelines with stages
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    // CRM-F15 FIX: Add safety cap (was unlimited)
    const pipelines = await prisma.crmPipeline.findMany({
      include: {
        stages: {
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return apiSuccess(pipelines, { request });
  } catch (error) {
    logger.error('[crm/pipelines] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch pipelines', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.pipelines.manage' });

// ---------------------------------------------------------------------------
// POST: Create a new pipeline with stages
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = createPipelineSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        request,
      });
    }

    const { name, isDefault, stages } = parsed.data;

    // Validate that positions are unique within the stages array
    const positions = stages.map(s => s.position);
    if (new Set(positions).size !== positions.length) {
      return apiError('Stage positions must be unique', ErrorCode.VALIDATION_ERROR, { request });
    }

    // Validate that at most one stage is isWon and at most one is isLost
    const wonCount = stages.filter(s => s.isWon).length;
    const lostCount = stages.filter(s => s.isLost).length;
    if (wonCount > 1) {
      return apiError('Only one stage can be marked as won', ErrorCode.VALIDATION_ERROR, { request });
    }
    if (lostCount > 1) {
      return apiError('Only one stage can be marked as lost', ErrorCode.VALIDATION_ERROR, { request });
    }

    // If this pipeline should be the default, unset any existing default
    if (isDefault) {
      await prisma.crmPipeline.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const pipeline = await prisma.crmPipeline.create({
      data: {
        name,
        isDefault,
        stages: {
          create: stages.map(s => ({
            name: s.name,
            position: s.position,
            probability: s.probability,
            color: s.color ?? null,
            isWon: s.isWon,
            isLost: s.isLost,
          })),
        },
      },
      include: {
        stages: {
          orderBy: { position: 'asc' },
        },
      },
    });

    logger.info('[crm/pipelines] Pipeline created', {
      pipelineId: pipeline.id,
      name: pipeline.name,
      stageCount: pipeline.stages.length,
    });

    return apiSuccess(pipeline, { status: 201, request });
  } catch (error) {
    logger.error('[crm/pipelines] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to create pipeline', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.pipelines.manage' });

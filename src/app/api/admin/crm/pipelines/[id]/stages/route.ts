export const dynamic = 'force-dynamic';

/**
 * CRM Pipeline Stages Reorder API
 * PUT /api/admin/crm/pipelines/[id]/stages — Reorder stages for a pipeline
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

const stagePositionSchema = z.object({
  id: z.string().min(1),
  position: z.number().int().min(0),
});

const reorderStagesSchema = z.object({
  stages: z.array(stagePositionSchema).min(1, 'At least one stage is required'),
});

// ---------------------------------------------------------------------------
// PUT: Reorder stages for a pipeline
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request: NextRequest, { params }) => {
  try {
    const pipelineId = params!.id;
    const body = await request.json();
    const parsed = reorderStagesSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        request,
        details: parsed.error.flatten(),
      });
    }

    const { stages } = parsed.data;

    // Validate that positions are unique
    const positions = stages.map(s => s.position);
    if (new Set(positions).size !== positions.length) {
      return apiError('Stage positions must be unique', ErrorCode.VALIDATION_ERROR, { request });
    }

    // Verify the pipeline exists
    const pipeline = await prisma.crmPipeline.findUnique({
      where: { id: pipelineId },
      include: { stages: { select: { id: true } } },
    });

    if (!pipeline) {
      return apiError('Pipeline not found', ErrorCode.NOT_FOUND, { request });
    }

    // Verify all stage IDs belong to this pipeline
    const existingStageIds = new Set(pipeline.stages.map(s => s.id));
    const invalidIds = stages.filter(s => !existingStageIds.has(s.id));
    if (invalidIds.length > 0) {
      return apiError(
        `Stage IDs not found in this pipeline: ${invalidIds.map(s => s.id).join(', ')}`,
        ErrorCode.VALIDATION_ERROR,
        { request }
      );
    }

    // Update all stage positions in a transaction
    await prisma.$transaction(
      stages.map(s =>
        prisma.crmPipelineStage.update({
          where: { id: s.id },
          data: { position: s.position },
        })
      )
    );

    // Fetch updated pipeline with reordered stages
    const updated = await prisma.crmPipeline.findUnique({
      where: { id: pipelineId },
      include: {
        stages: {
          orderBy: { position: 'asc' },
        },
      },
    });

    logger.info('[crm/pipelines] Stages reordered', {
      pipelineId,
      stageCount: stages.length,
    });

    return apiSuccess(updated, { request });
  } catch (error) {
    logger.error('[crm/pipelines/stages] PUT error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to reorder stages', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.pipelines.manage' });

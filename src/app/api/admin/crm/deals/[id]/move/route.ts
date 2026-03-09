export const dynamic = 'force-dynamic';

/**
 * CRM Deal Move API
 * POST /api/admin/crm/deals/[id]/move -- Move deal to a new stage
 *
 * Creates a CrmDealStageHistory entry, a CrmActivity, and handles
 * automatic won/lost detection based on stage flags.
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

const moveDealSchema = z.object({
  stageId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// POST: Move deal to a new stage
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (
  request: NextRequest,
  { session, params }: { session: { user: { id: string } }; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = moveDealSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        request,
        details: parsed.error.flatten(),
      });
    }

    const { stageId: newStageId } = parsed.data;

    // Fetch deal with current stage info
    const deal = await prisma.crmDeal.findUnique({
      where: { id },
      include: {
        stage: true,
      },
    });

    if (!deal) {
      return apiError('Deal not found', ErrorCode.NOT_FOUND, { request });
    }

    if (deal.stageId === newStageId) {
      return apiError('Deal is already in this stage', ErrorCode.VALIDATION_ERROR, { request });
    }

    // Verify new stage exists and belongs to the same pipeline
    const newStage = await prisma.crmPipelineStage.findFirst({
      where: { id: newStageId, pipelineId: deal.pipelineId },
    });

    if (!newStage) {
      return apiError('Target stage not found or does not belong to the deal pipeline', ErrorCode.NOT_FOUND, { request });
    }

    // Calculate duration in the previous stage (seconds since last stage change)
    const lastHistoryEntry = await prisma.crmDealStageHistory.findFirst({
      where: { dealId: id },
      orderBy: { createdAt: 'desc' },
    });

    const durationSeconds = lastHistoryEntry
      ? Math.floor((Date.now() - lastHistoryEntry.createdAt.getTime()) / 1000)
      : Math.floor((Date.now() - deal.createdAt.getTime()) / 1000);

    // Execute move in a transaction
    const updatedDeal = await prisma.$transaction(async (tx) => {
      // Build deal update data
      const dealUpdateData: Record<string, unknown> = {
        stageId: newStageId,
      };

      // If new stage is won or lost, set actualCloseDate
      if (newStage.isWon || newStage.isLost) {
        dealUpdateData.actualCloseDate = new Date();
      }

      // Update deal stage
      const updated = await tx.crmDeal.update({
        where: { id },
        data: dealUpdateData,
        include: {
          stage: { select: { id: true, name: true, color: true, probability: true, isWon: true, isLost: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          lead: { select: { id: true, contactName: true } },
          contact: { select: { id: true, name: true, email: true } },
        },
      });

      // Create stage history entry
      await tx.crmDealStageHistory.create({
        data: {
          dealId: id,
          fromStageId: deal.stageId,
          toStageId: newStageId,
          changedById: session.user.id,
          duration: durationSeconds,
        },
      });

      // Create stage change activity
      await tx.crmActivity.create({
        data: {
          type: 'STATUS_CHANGE',
          title: `Deal moved from "${deal.stage.name}" to "${newStage.name}"`,
          dealId: id,
          performedById: session.user.id,
          metadata: {
            fromStageId: deal.stageId,
            fromStageName: deal.stage.name,
            toStageId: newStageId,
            toStageName: newStage.name,
            duration: durationSeconds,
          },
        },
      });

      // If won, create DEAL_WON activity
      if (newStage.isWon) {
        await tx.crmActivity.create({
          data: {
            type: 'DEAL_WON',
            title: 'Deal won',
            description: `Deal "${deal.title}" has been won`,
            dealId: id,
            performedById: session.user.id,
            metadata: {
              value: String(deal.value),
              currency: deal.currency,
            },
          },
        });
      }

      // If lost, create DEAL_LOST activity
      if (newStage.isLost) {
        await tx.crmActivity.create({
          data: {
            type: 'DEAL_LOST',
            title: 'Deal lost',
            description: `Deal "${deal.title}" has been lost`,
            dealId: id,
            performedById: session.user.id,
            metadata: {
              value: String(deal.value),
              currency: deal.currency,
            },
          },
        });
      }

      return updated;
    });

    logger.info('[crm/deals/[id]/move] Deal moved', {
      dealId: id,
      fromStageId: deal.stageId,
      toStageId: newStageId,
      isWon: newStage.isWon,
      isLost: newStage.isLost,
      movedBy: session.user.id,
    });

    return apiSuccess(updatedDeal, { request });
  } catch (error) {
    logger.error('[crm/deals/[id]/move] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to move deal', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.deals.edit' });

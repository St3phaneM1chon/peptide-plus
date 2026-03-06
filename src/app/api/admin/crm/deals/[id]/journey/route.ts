export const dynamic = 'force-dynamic';

/**
 * CRM Deal Journey API
 * GET /api/admin/crm/deals/[id]/journey - Get full journey for a deal
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// Map CrmActivityType enum → frontend event type
function mapActivityType(type: string): string {
  const mapping: Record<string, string> = {
    CALL: 'call',
    EMAIL: 'email',
    SMS: 'email',
    MEETING: 'meeting',
    NOTE: 'note',
    STATUS_CHANGE: 'stage_change',
    DEAL_CREATED: 'activity',
    DEAL_WON: 'activity',
    DEAL_LOST: 'activity',
  };
  return mapping[type] || 'activity';
}

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    const deal = await prisma.crmDeal.findUnique({
      where: { id },
      include: {
        stage: { select: { id: true, name: true, isWon: true, isLost: true } },
        stageHistory: {
          include: {
            fromStage: { select: { id: true, name: true } },
            toStage: { select: { id: true, name: true } },
            changedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        activities: {
          include: {
            performedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!deal) {
      return apiError('Deal not found', ErrorCode.NOT_FOUND, { status: 404, request });
    }

    // Build events from activities + stage changes
    const events = [
      ...deal.activities.map((a) => ({
        id: a.id,
        type: mapActivityType(a.type),
        title: a.title,
        description: a.description,
        timestamp: a.createdAt.toISOString(),
        metadata: {
          activityType: a.type,
          performedBy: a.performedBy?.name || a.performedBy?.email || null,
          ...(a.metadata && typeof a.metadata === 'object' ? a.metadata as Record<string, unknown> : {}),
        },
      })),
      ...deal.stageHistory.map((sh) => ({
        id: sh.id,
        type: 'stage_change' as const,
        title: `Stage: ${sh.fromStage?.name || 'New'} → ${sh.toStage.name}`,
        description: `Changed by ${sh.changedBy?.name || sh.changedBy?.email || 'System'}`,
        timestamp: sh.createdAt.toISOString(),
        metadata: {
          fromStage: sh.fromStage?.name || null,
          toStage: sh.toStage.name,
          durationSeconds: sh.duration,
        },
      })),
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Build stage timeline from stage history
    const stageTimeline: { stageName: string; enteredAt: string; exitedAt: string | null; durationHours: number }[] = [];
    for (let i = 0; i < deal.stageHistory.length; i++) {
      const sh = deal.stageHistory[i];
      const nextSh = deal.stageHistory[i + 1];
      stageTimeline.push({
        stageName: sh.toStage.name,
        enteredAt: sh.createdAt.toISOString(),
        exitedAt: nextSh ? nextSh.createdAt.toISOString() : null,
        durationHours: nextSh
          ? (nextSh.createdAt.getTime() - sh.createdAt.getTime()) / (1000 * 60 * 60)
          : (Date.now() - sh.createdAt.getTime()) / (1000 * 60 * 60),
      });
    }

    const createdAt = deal.createdAt;
    const closedAt = deal.actualCloseDate;
    const totalDurationDays = Math.round(
      ((closedAt?.getTime() || Date.now()) - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const journey = {
      dealId: deal.id,
      dealTitle: deal.title,
      dealValue: Number(deal.value),
      currency: deal.currency,
      currentStage: deal.stage.name,
      isWon: deal.stage.isWon,
      isLost: deal.stage.isLost,
      createdAt: createdAt.toISOString(),
      closedAt: closedAt?.toISOString() || null,
      totalDurationDays,
      events,
      stageTimeline,
      touchpointCount: deal.activities.length,
    };

    return apiSuccess(journey, { request });
  } catch (error) {
    logger.error('[crm/deals/[id]/journey] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch deal journey', ErrorCode.INTERNAL_ERROR, { request });
  }
});

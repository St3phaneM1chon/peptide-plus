export const dynamic = 'force-dynamic';

/**
 * CRM Campaign Detail API
 * GET    /api/admin/crm/campaigns/[id] -- Campaign detail with stats
 * PATCH  /api/admin/crm/campaigns/[id] -- Update campaign fields
 * DELETE /api/admin/crm/campaigns/[id] -- Delete campaign (only DRAFT/CANCELLED)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiNoContent } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';
import { CrmCampaignType, CrmCampaignStatus, Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.nativeEnum(CrmCampaignType).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.nativeEnum(CrmCampaignStatus).optional(),
  targetCriteria: z.record(z.unknown()).optional().nullable(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  callerIdNumber: z.string().max(20).optional().nullable(),
  maxAttemptsPerLead: z.number().int().min(1).max(10).optional(),
  retryIntervalHours: z.number().int().min(1).max(168).optional(),
  callScriptId: z.string().optional().nullable(),
});

// ---------------------------------------------------------------------------
// GET: Campaign detail with stats
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    const campaign = await prisma.crmCampaign.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            leadId: true,
            attempt: true,
            channel: true,
            status: true,
            disposition: true,
            duration: true,
            scheduledAt: true,
            completedAt: true,
            createdAt: true,
          },
        },
        _count: { select: { activities: true } },
      },
    });

    if (!campaign) {
      return apiError('Campaign not found', ErrorCode.NOT_FOUND, { request });
    }

    // Compute derived stats
    const contactRate = campaign.totalLeads > 0
      ? Math.round((campaign.contacted / campaign.totalLeads) * 100)
      : 0;
    const conversionRate = campaign.contacted > 0
      ? Math.round((campaign.converted / campaign.contacted) * 100)
      : 0;
    const connectionRate = campaign.contacted > 0
      ? Math.round((campaign.connected / campaign.contacted) * 100)
      : 0;

    return apiSuccess({
      ...campaign,
      activityCount: campaign._count.activities,
      stats: {
        contactRate,
        conversionRate,
        connectionRate,
        revenue: Number(campaign.revenue),
      },
    }, { request });
  } catch (error) {
    logger.error('[crm/campaigns/[id]] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch campaign', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.campaigns.view' });

// ---------------------------------------------------------------------------
// PATCH: Update campaign fields
// ---------------------------------------------------------------------------

export const PATCH = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        request,
        details: parsed.error.flatten(),
      });
    }

    const existing = await prisma.crmCampaign.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing) {
      return apiError('Campaign not found', ErrorCode.NOT_FOUND, { request });
    }

    // Build update data
    const data: Prisma.CrmCampaignUpdateInput = {};
    const {
      name, type, description, status,
      targetCriteria, startAt, endAt,
      callerIdNumber, maxAttemptsPerLead,
      retryIntervalHours, callScriptId,
    } = parsed.data;

    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type;
    if (description !== undefined) data.description = description;
    if (status !== undefined) data.status = status;
    if (targetCriteria !== undefined) {
      data.targetCriteria = targetCriteria ? (targetCriteria as Prisma.InputJsonValue) : Prisma.JsonNull;
    }
    if (startAt !== undefined) data.startAt = startAt ? new Date(startAt) : null;
    if (endAt !== undefined) data.endAt = endAt ? new Date(endAt) : null;
    if (callerIdNumber !== undefined) data.callerIdNumber = callerIdNumber;
    if (maxAttemptsPerLead !== undefined) data.maxAttemptsPerLead = maxAttemptsPerLead;
    if (retryIntervalHours !== undefined) data.retryIntervalHours = retryIntervalHours;
    if (callScriptId !== undefined) data.callScriptId = callScriptId;

    const campaign = await prisma.crmCampaign.update({
      where: { id },
      data,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    logger.info('[crm/campaigns/[id]] Campaign updated', { campaignId: id, status: campaign.status });

    return apiSuccess(campaign, { request });
  } catch (error) {
    logger.error('[crm/campaigns/[id]] PATCH error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to update campaign', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.campaigns.manage' });

// ---------------------------------------------------------------------------
// DELETE: Delete a campaign (only DRAFT or CANCELLED)
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    const existing = await prisma.crmCampaign.findUnique({
      where: { id },
      select: { id: true, status: true, name: true },
    });

    if (!existing) {
      return apiError('Campaign not found', ErrorCode.NOT_FOUND, { request });
    }

    // Only allow deleting DRAFT or CANCELLED campaigns
    if (
      existing.status !== CrmCampaignStatus.DRAFT &&
      existing.status !== CrmCampaignStatus.CANCELLED
    ) {
      return apiError(
        'Only DRAFT or CANCELLED campaigns can be deleted. Stop or cancel the campaign first.',
        ErrorCode.VALIDATION_ERROR,
        { status: 409, request }
      );
    }

    await prisma.crmCampaign.delete({ where: { id } });

    logger.info('[crm/campaigns/[id]] Campaign deleted', { campaignId: id, name: existing.name });

    return apiNoContent({ request });
  } catch (error) {
    logger.error('[crm/campaigns/[id]] DELETE error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to delete campaign', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.campaigns.manage' });

export const dynamic = 'force-dynamic';

/**
 * CRM Campaign Start API
 * POST /api/admin/crm/campaigns/[id]/start
 *
 * Starts campaign execution:
 * 1. Validates campaign is in DRAFT or SCHEDULED status
 * 2. Sets status to ACTIVE
 * 3. Queries leads matching targetCriteria
 * 4. Creates CrmCampaignActivity records (one per lead, per channel)
 * 5. Updates totalLeads count on campaign
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';
import { CrmCampaignStatus, CrmCampaignType, Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Helpers: resolve leads matching targetCriteria
// ---------------------------------------------------------------------------

async function resolveMatchingLeads(
  targetCriteria: Prisma.JsonValue | null
): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const criteria: Record<string, any> =
    targetCriteria && typeof targetCriteria === 'object' && !Array.isArray(targetCriteria)
      ? (targetCriteria as Record<string, unknown>)
      : {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    // Exclude DNC leads by default
    dncStatus: 'CALLABLE',
  };

  if (criteria.status) where.status = criteria.status;
  if (criteria.temperature) where.temperature = criteria.temperature;
  if (criteria.assignedToId) where.assignedToId = criteria.assignedToId;
  if (criteria.source) where.source = criteria.source;
  if (criteria.minScore !== undefined) {
    where.score = { ...(where.score || {}), gte: criteria.minScore };
  }
  if (criteria.maxScore !== undefined) {
    where.score = { ...(where.score || {}), lte: criteria.maxScore };
  }
  if (criteria.tags && Array.isArray(criteria.tags) && criteria.tags.length > 0) {
    where.tags = { hasSome: criteria.tags };
  }

  const leads = await prisma.crmLead.findMany({
    where,
    select: { id: true },
    // Safety cap: max 10,000 leads per campaign launch
    take: 10000,
  });

  return leads.map(l => l.id);
}

// ---------------------------------------------------------------------------
// Determine channels for a campaign type
// ---------------------------------------------------------------------------

function getChannels(type: CrmCampaignType): string[] {
  switch (type) {
    case CrmCampaignType.CALL:
      return ['call'];
    case CrmCampaignType.EMAIL:
      return ['email'];
    case CrmCampaignType.SMS:
      return ['sms'];
    case CrmCampaignType.MULTI_CHANNEL:
      return ['call', 'email', 'sms'];
    default:
      return ['call'];
  }
}

// ---------------------------------------------------------------------------
// POST: Start campaign
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: { user: { id: string } }; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    const campaign = await prisma.crmCampaign.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        type: true,
        targetCriteria: true,
        maxAttemptsPerLead: true,
      },
    });

    if (!campaign) {
      return apiError('Campaign not found', ErrorCode.NOT_FOUND, { request });
    }

    // Only allow starting DRAFT or SCHEDULED campaigns
    if (
      campaign.status !== CrmCampaignStatus.DRAFT &&
      campaign.status !== CrmCampaignStatus.SCHEDULED
    ) {
      return apiError(
        `Cannot start a campaign with status "${campaign.status}". Only DRAFT or SCHEDULED campaigns can be started.`,
        ErrorCode.VALIDATION_ERROR,
        { status: 409, request }
      );
    }

    // Resolve leads matching criteria
    const leadIds = await resolveMatchingLeads(campaign.targetCriteria);

    if (leadIds.length === 0) {
      return apiError(
        'No matching leads found for this campaign criteria. Adjust the target criteria and try again.',
        ErrorCode.VALIDATION_ERROR,
        { status: 422, request }
      );
    }

    const channels = getChannels(campaign.type);
    const now = new Date();

    // Run in a transaction: update campaign + create activities
    const result = await prisma.$transaction(async (tx) => {
      // Delete any existing pending activities (idempotent restart)
      await tx.crmCampaignActivity.deleteMany({
        where: { campaignId: id, status: 'pending' },
      });

      // Bulk create activity records for each lead x channel
      const activityData: Prisma.CrmCampaignActivityCreateManyInput[] = [];

      for (const leadId of leadIds) {
        for (const channel of channels) {
          activityData.push({
            campaignId: id,
            leadId,
            attempt: 1,
            channel,
            status: 'pending',
            scheduledAt: now,
          });
        }
      }

      // createMany for bulk insert
      await tx.crmCampaignActivity.createMany({
        data: activityData,
        skipDuplicates: true,
      });

      // Update campaign: set ACTIVE + totalLeads
      const updated = await tx.crmCampaign.update({
        where: { id },
        data: {
          status: CrmCampaignStatus.ACTIVE,
          totalLeads: leadIds.length,
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          _count: { select: { activities: true } },
        },
      });

      return updated;
    });

    logger.info('[crm/campaigns/start] Campaign started', {
      campaignId: id,
      name: campaign.name,
      leadCount: leadIds.length,
      channels,
    });

    return apiSuccess({
      campaign: result,
      leadsEnrolled: leadIds.length,
      activitiesCreated: leadIds.length * channels.length,
      channels,
    }, { status: 200, request });
  } catch (error) {
    logger.error('[crm/campaigns/[id]/start] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to start campaign', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.campaigns.manage' });

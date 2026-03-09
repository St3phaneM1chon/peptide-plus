export const dynamic = 'force-dynamic';

/**
 * CRM Campaigns API
 * GET  /api/admin/crm/campaigns -- Paginated list with stats, filter by status/type
 * POST /api/admin/crm/campaigns -- Create a new campaign
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';
import { CrmCampaignType, CrmCampaignStatus, Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.nativeEnum(CrmCampaignType),
  description: z.string().max(2000).optional().nullable(),
  targetCriteria: z.record(z.unknown()).optional().nullable(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  // Settings
  callerIdNumber: z.string().max(20).optional().nullable(),
  maxAttemptsPerLead: z.number().int().min(1).max(10).default(3),
  retryIntervalHours: z.number().int().min(1).max(168).default(24),
  callScriptId: z.string().optional().nullable(),
});

// ---------------------------------------------------------------------------
// GET: List campaigns (paginated, filtered)
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    // Filters
    const status = searchParams.get('status') as CrmCampaignStatus | null;
    const type = searchParams.get('type') as CrmCampaignType | null;
    const search = searchParams.get('search');

    const where: Prisma.CrmCampaignWhereInput = {};

    if (status && Object.values(CrmCampaignStatus).includes(status)) {
      where.status = status;
    }
    if (type && Object.values(CrmCampaignType).includes(type)) {
      where.type = type;
    }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [campaigns, total] = await Promise.all([
      prisma.crmCampaign.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          _count: { select: { activities: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.crmCampaign.count({ where }),
    ]);

    // Enrich with derived stats
    const enriched = campaigns.map(c => ({
      ...c,
      activityCount: c._count.activities,
      contactRate: c.totalLeads > 0 ? Math.round((c.contacted / c.totalLeads) * 100) : 0,
      conversionRate: c.contacted > 0 ? Math.round((c.converted / c.contacted) * 100) : 0,
    }));

    return apiPaginated(enriched, page, limit, total, { request });
  } catch (error) {
    logger.error('[crm/campaigns] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch campaigns', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.campaigns.view' });

// ---------------------------------------------------------------------------
// POST: Create a new campaign
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (
  request: NextRequest,
  { session }: { session: { user: { id: string } } }
) => {
  try {
    const body = await request.json();
    const parsed = createCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        request,
        details: parsed.error.flatten(),
      });
    }

    const {
      name, type, description, targetCriteria,
      startAt, endAt, callerIdNumber,
      maxAttemptsPerLead, retryIntervalHours, callScriptId,
    } = parsed.data;

    const campaign = await prisma.crmCampaign.create({
      data: {
        name,
        type,
        status: CrmCampaignStatus.DRAFT,
        description: description ?? null,
        targetCriteria: targetCriteria ? (targetCriteria as Prisma.InputJsonValue) : Prisma.JsonNull,
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
        callerIdNumber: callerIdNumber ?? null,
        maxAttemptsPerLead,
        retryIntervalHours,
        callScriptId: callScriptId ?? null,
        createdById: session.user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    logger.info('[crm/campaigns] Campaign created', {
      campaignId: campaign.id,
      name: campaign.name,
      type: campaign.type,
      createdBy: session.user.id,
    });

    return apiSuccess(campaign, { status: 201, request });
  } catch (error) {
    logger.error('[crm/campaigns] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to create campaign', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.campaigns.manage' });

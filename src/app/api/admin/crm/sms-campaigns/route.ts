export const dynamic = 'force-dynamic';

/**
 * CRM SMS Campaigns API
 * GET  /api/admin/crm/sms-campaigns - List SMS campaigns (paginated, filterable by status)
 * POST /api/admin/crm/sms-campaigns - Create a new SMS campaign
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createCampaignSchema = z.object({
  name: z.string().min(1, 'Name is required').max(300).trim(),
  templateId: z.string().cuid().optional(),
  message: z.string().max(1600).optional(),
  segmentCriteria: z.record(z.unknown()).optional(),
  scheduledAt: z.string().datetime().optional(),
});

// ---------------------------------------------------------------------------
// GET: List SMS campaigns
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const status = searchParams.get('status');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (status) where.status = status;

    const [campaigns, total] = await Promise.all([
      prisma.smsCampaign.findMany({
        where,
        include: {
          template: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.smsCampaign.count({ where }),
    ]);

    return apiPaginated(campaigns, page, limit, total, { request });
  } catch (error) {
    const logger = await import('@/lib/logger').then(m => m.logger);
    logger.error('[SMS Campaigns] Error listing campaigns', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to list campaigns', ErrorCode.INTERNAL_ERROR, { status: 500, request });
  }
}, { requiredPermission: 'crm.campaigns.view' });

// ---------------------------------------------------------------------------
// POST: Create a campaign
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
        status: 400,
        details: parsed.error.flatten(),
        request,
      });
    }

    const { name, templateId, message, segmentCriteria, scheduledAt } = parsed.data;

    // Must have either templateId or message
    if (!templateId && !message) {
      return apiError('Either templateId or message is required', ErrorCode.VALIDATION_ERROR, {
        status: 400,
        request,
      });
    }

    // Validate template exists if provided
    if (templateId) {
      const template = await prisma.smsTemplate.findUnique({
        where: { id: templateId },
        select: { id: true },
      });
      if (!template) {
        return apiError('SMS template not found', ErrorCode.RESOURCE_NOT_FOUND, { request });
      }
    }

    const campaign = await prisma.smsCampaign.create({
      data: {
        name,
        templateId: templateId || null,
        message: message || null,
        segmentCriteria: segmentCriteria ? JSON.parse(JSON.stringify(segmentCriteria)) : undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
        createdById: session.user.id,
      },
      include: {
        template: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return apiSuccess(campaign, { status: 201, request });
  } catch (error) {
    const logger = await import('@/lib/logger').then(m => m.logger);
    logger.error('[SMS Campaigns] Error creating campaign', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to create campaign', ErrorCode.INTERNAL_ERROR, { status: 500, request });
  }
}, { requiredPermission: 'crm.campaigns.manage' });

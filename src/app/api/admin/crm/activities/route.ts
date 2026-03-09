export const dynamic = 'force-dynamic';

/**
 * CRM Activities API
 * POST /api/admin/crm/activities -- Create a new CRM activity
 * GET  /api/admin/crm/activities -- List activities (optionally filtered by leadId/dealId)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ErrorCode } from '@/lib/error-codes';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const createActivitySchema = z.object({
  type: z.enum(['CALL', 'EMAIL', 'SMS', 'MEETING', 'NOTE', 'STATUS_CHANGE', 'DEAL_CREATED', 'DEAL_WON', 'DEAL_LOST']),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  leadId: z.string().cuid().optional(),
  dealId: z.string().cuid().optional(),
  contactId: z.string().cuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// POST: Create a CRM activity
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (
  request: NextRequest,
  { session }: { session: { user: { id: string } } }
) => {
  try {
    const body = await request.json();
    const parsed = createActivitySchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        'Invalid activity data',
        ErrorCode.VALIDATION_ERROR,
        { request, details: parsed.error.flatten(), status: 400 }
      );
    }

    const { type, title, description, leadId, dealId, contactId, metadata } = parsed.data;

    // Verify lead exists if provided
    if (leadId) {
      const lead = await prisma.crmLead.findUnique({ where: { id: leadId }, select: { id: true } });
      if (!lead) {
        return apiError('Lead not found', ErrorCode.NOT_FOUND, { request, status: 404 });
      }
    }

    // Verify deal exists if provided
    if (dealId) {
      const deal = await prisma.crmDeal.findUnique({ where: { id: dealId }, select: { id: true } });
      if (!deal) {
        return apiError('Deal not found', ErrorCode.NOT_FOUND, { request, status: 404 });
      }
    }

    const activity = await prisma.crmActivity.create({
      data: {
        type,
        title,
        description: description || null,
        leadId: leadId || null,
        dealId: dealId || null,
        contactId: contactId || null,
        performedById: session.user.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: (metadata || undefined) as any,
      },
      include: {
        performedBy: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, contactName: true } },
        deal: { select: { id: true, title: true } },
      },
    });

    logger.info('[crm/activities] Activity created', {
      activityId: activity.id,
      type,
      leadId,
      dealId,
      performedById: session.user.id,
    });

    return apiSuccess(activity, { request, status: 201 });
  } catch (error) {
    logger.error('[crm/activities] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to create activity', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.leads.edit' });

// ---------------------------------------------------------------------------
// GET: List CRM activities (filtered by leadId or dealId)
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId') || undefined;
    const dealId = searchParams.get('dealId') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const where = {
      ...(leadId ? { leadId } : {}),
      ...(dealId ? { dealId } : {}),
    };

    const [activities, total] = await Promise.all([
      prisma.crmActivity.findMany({
        where,
        include: {
          performedBy: { select: { id: true, name: true, email: true } },
          lead: { select: { id: true, contactName: true } },
          deal: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.crmActivity.count({ where }),
    ]);

    return apiPaginated(activities, page, limit, total, { request });
  } catch (error) {
    logger.error('[crm/activities] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch activities', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.leads.view', skipCsrf: true });

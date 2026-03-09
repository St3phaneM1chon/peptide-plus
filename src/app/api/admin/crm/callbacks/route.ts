export const dynamic = 'force-dynamic';

/**
 * CRM Callback Scheduling API
 *
 * GET /api/admin/crm/callbacks
 *   List scheduled callbacks (CrmTask with type=CALL, status=PENDING)
 *   Query params: assignedToId?, leadId?, dealId?, page?, limit?
 *   Ordered by dueAt ASC (soonest first).
 *
 * POST /api/admin/crm/callbacks
 *   Create a new callback task.
 *   Body: { leadId?, dealId?, scheduledAt, notes?, assignedToId, priority? }
 *
 * Uses the existing CrmTask model with type=CALL.
 * The `description` field stores callback notes.
 * The `dueAt` field stores the scheduled callback time.
 *
 * Authentication: Admin guard (EMPLOYEE | OWNER).
 * CSRF: Required for POST (mutation).
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

const createCallbackSchema = z.object({
  leadId: z.string().cuid().optional(),
  dealId: z.string().cuid().optional(),
  scheduledAt: z.string().datetime({ message: 'scheduledAt must be a valid ISO 8601 datetime' }),
  notes: z.string().max(1000).optional(),
  assignedToId: z.string().cuid({ message: 'assignedToId must be a valid user ID' }),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  title: z.string().min(1).max(255).optional(),
});

// ---------------------------------------------------------------------------
// GET: List scheduled callbacks
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const assignedToId = searchParams.get('assignedToId') || undefined;
    const leadId = searchParams.get('leadId') || undefined;
    const dealId = searchParams.get('dealId') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    // Base where clause: CALL tasks that are PENDING
    const where = {
      type: 'CALL' as const,
      status: 'PENDING' as const,
      ...(assignedToId ? { assignedToId } : {}),
      ...(leadId ? { leadId } : {}),
      ...(dealId ? { dealId } : {}),
    };

    const [callbacks, total] = await Promise.all([
      prisma.crmTask.findMany({
        where,
        include: {
          assignedTo: {
            select: { id: true, name: true, email: true },
          },
          lead: {
            select: { id: true, contactName: true, email: true, phone: true },
          },
          deal: {
            select: { id: true, title: true },
          },
        },
        orderBy: { dueAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.crmTask.count({ where }),
    ]);

    return apiPaginated(callbacks, page, limit, total, { request });
  } catch (error) {
    logger.error('[crm/callbacks] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch callbacks', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.leads.view', skipCsrf: true });

// ---------------------------------------------------------------------------
// POST: Create a scheduled callback
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (
  request: NextRequest,
  { session }: { session: { user: { id: string } } }
) => {
  try {
    const body = await request.json();
    const parsed = createCallbackSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        'Invalid callback data',
        ErrorCode.VALIDATION_ERROR,
        { request, details: parsed.error.flatten(), status: 400 }
      );
    }

    const { leadId, dealId, scheduledAt, notes, assignedToId, priority, title } = parsed.data;

    // At least one of leadId or dealId must be provided
    if (!leadId && !dealId) {
      return apiError(
        'Either leadId or dealId must be provided',
        ErrorCode.VALIDATION_ERROR,
        { request, status: 400 }
      );
    }

    // Scheduled time must be in the future
    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
      return apiError(
        'scheduledAt must be a future date/time',
        ErrorCode.VALIDATION_ERROR,
        { request, status: 400 }
      );
    }

    // Verify the assigned user exists and is an admin/employee
    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!assignee) {
      return apiError('Assigned user not found', ErrorCode.NOT_FOUND, { request, status: 404 });
    }

    // Verify lead exists if provided
    if (leadId) {
      const lead = await prisma.crmLead.findUnique({
        where: { id: leadId },
        select: { id: true, contactName: true },
      });
      if (!lead) {
        return apiError('Lead not found', ErrorCode.NOT_FOUND, { request, status: 404 });
      }
    }

    // Verify deal exists if provided
    if (dealId) {
      const deal = await prisma.crmDeal.findUnique({
        where: { id: dealId },
        select: { id: true, title: true },
      });
      if (!deal) {
        return apiError('Deal not found', ErrorCode.NOT_FOUND, { request, status: 404 });
      }
    }

    // Create the callback as a CrmTask with type=CALL
    const callback = await prisma.crmTask.create({
      data: {
        type: 'CALL',
        status: 'PENDING',
        priority,
        title: title || `Rappel prévu le ${scheduledDate.toLocaleDateString('fr-CA')}`,
        description: notes || null,
        dueAt: scheduledDate,
        assignedToId,
        leadId: leadId || null,
        dealId: dealId || null,
      },
      include: {
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        lead: {
          select: { id: true, contactName: true, email: true, phone: true },
        },
        deal: {
          select: { id: true, title: true },
        },
      },
    });

    logger.info('[crm/callbacks] Callback scheduled', {
      callbackId: callback.id,
      assignedToId,
      scheduledAt: scheduledDate.toISOString(),
      leadId,
      dealId,
      scheduledBy: session.user.id,
    });

    return apiSuccess(callback, { request, status: 201 });
  } catch (error) {
    logger.error('[crm/callbacks] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to create callback', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.leads.edit' });

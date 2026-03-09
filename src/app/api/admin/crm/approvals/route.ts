export const dynamic = 'force-dynamic';

/**
 * CRM Approvals API
 * GET  /api/admin/crm/approvals - List approvals with optional filters
 * POST /api/admin/crm/approvals - Create a new approval request
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError, apiPaginated } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';
import { ApprovalStatus, Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createApprovalSchema = z.object({
  entityType: z.string().min(1).max(100),
  entityId: z.string().min(1),
  reason: z.string().max(2000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// GET: List approvals (paginated, filtered)
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    // Filters
    const status = searchParams.get('status') as ApprovalStatus | null;
    const entityType = searchParams.get('entityType');

    const where: Prisma.CrmApprovalWhereInput = {};

    if (status && Object.values(ApprovalStatus).includes(status)) {
      where.status = status;
    }
    if (entityType) {
      where.entityType = entityType;
    }

    const [approvals, total] = await Promise.all([
      prisma.crmApproval.findMany({
        where,
        include: {
          requestedBy: { select: { id: true, name: true, email: true } },
          approver: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.crmApproval.count({ where }),
    ]);

    return apiPaginated(approvals, page, limit, total, { request });
  } catch (error) {
    logger.error('[crm/approvals] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch approvals', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.leads.view' });

// ---------------------------------------------------------------------------
// POST: Create a new approval request
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (
  request: NextRequest,
  { session }: { session: { user: { id: string } } }
) => {
  try {
    const body = await request.json();
    const parsed = createApprovalSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input', ErrorCode.VALIDATION_ERROR, {
        request,
        details: parsed.error.flatten(),
      });
    }

    const { entityType, entityId, reason } = parsed.data;

    // Check for existing pending approval on the same entity
    const existing = await prisma.crmApproval.findFirst({
      where: {
        entityType,
        entityId,
        status: ApprovalStatus.PENDING,
      },
    });

    if (existing) {
      return apiError(
        'A pending approval already exists for this entity',
        ErrorCode.CONFLICT,
        { status: 409, request }
      );
    }

    const approval = await prisma.crmApproval.create({
      data: {
        entityType,
        entityId,
        reason: reason ?? null,
        status: ApprovalStatus.PENDING,
        requestedById: session.user.id,
      },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } },
      },
    });

    logger.info('[crm/approvals] Approval request created', {
      approvalId: approval.id,
      entityType: approval.entityType,
      entityId: approval.entityId,
      requestedBy: session.user.id,
    });

    return apiSuccess(approval, { status: 201, request });
  } catch (error) {
    logger.error('[crm/approvals] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to create approval request', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.leads.edit' });

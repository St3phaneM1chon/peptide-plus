export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const respondSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().max(2000).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/approvals/[id] - Approval request details
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest, { params }) => {
  try {
    const { id } = params;

    const approval = await prisma.approvalRequest.findUnique({
      where: { id },
      include: { workflowRule: { select: { id: true, name: true, entityType: true } } },
    });

    if (!approval) {
      return apiError('Approval request not found', 'NOT_FOUND', { status: 404, request });
    }

    // Auto-expire if overdue
    if (approval.status === 'PENDING' && approval.expiresAt && approval.expiresAt < new Date()) {
      await prisma.approvalRequest.update({
        where: { id },
        data: { status: 'EXPIRED' },
      });
      approval.status = 'EXPIRED';
    }

    return apiSuccess(
      {
        id: approval.id,
        workflowRuleId: approval.workflowRuleId,
        workflowRuleName: approval.workflowRule?.name ?? null,
        entityType: approval.entityType,
        entityId: approval.entityId,
        entitySummary: approval.entitySummary,
        amount: approval.amount ? Number(approval.amount) : null,
        status: approval.status,
        requestedBy: approval.requestedBy,
        requestedAt: approval.requestedAt,
        assignedRole: approval.assignedRole,
        assignedTo: approval.assignedTo,
        expiresAt: approval.expiresAt,
        respondedBy: approval.respondedBy,
        respondedAt: approval.respondedAt,
        responseNote: approval.responseNote,
        createdAt: approval.createdAt,
        updatedAt: approval.updatedAt,
      },
      { request },
    );
  } catch (error) {
    logger.error('Error fetching approval request', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Error fetching approval request', 'INTERNAL_ERROR', { status: 500, request });
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/approvals/[id] - Approve or reject
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { params, session }) => {
  try {
    const { id } = params;

    const body = await request.json();
    const parsed = respondSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid data', 'VALIDATION_ERROR', {
        status: 400,
        request,
      });
    }

    const { action, note } = parsed.data;

    const approval = await prisma.approvalRequest.findUnique({
      where: { id },
    });

    if (!approval) {
      return apiError('Approval request not found', 'NOT_FOUND', { status: 404, request });
    }

    if (approval.status !== 'PENDING') {
      return apiError(
        `Cannot ${action}: current status is ${approval.status}`,
        'VALIDATION_ERROR',
        { status: 400, request },
      );
    }

    // Check expiry
    if (approval.expiresAt && approval.expiresAt < new Date()) {
      await prisma.approvalRequest.update({
        where: { id },
        data: { status: 'EXPIRED' },
      });
      return apiError('Approval request has expired', 'VALIDATION_ERROR', { status: 400, request });
    }

    const respondedBy = session.user?.email || session.user?.id || 'unknown';

    // ACCT-F1 CRITICAL FIX: Segregation of duties — cannot approve own request
    if (action === 'approve' && approval.requestedBy === respondedBy) {
      return apiError('Cannot approve your own request (segregation of duties)', 'FORBIDDEN', { status: 403, request });
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    const updated = await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: newStatus,
        respondedBy,
        respondedAt: new Date(),
        responseNote: note || null,
      },
    });

    logger.info(`Approval request ${action}d`, {
      requestId: id,
      respondedBy,
      entityType: approval.entityType,
      entityId: approval.entityId,
      newStatus,
    });

    return apiSuccess(
      {
        id: updated.id,
        status: updated.status,
        respondedBy: updated.respondedBy,
        respondedAt: updated.respondedAt,
        responseNote: updated.responseNote,
      },
      { request },
    );
  } catch (error) {
    logger.error('Error responding to approval request', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Error processing approval response', 'INTERNAL_ERROR', { status: 500, request });
  }
});

export const dynamic = 'force-dynamic';

/**
 * CRM Approval Detail API
 * GET /api/admin/crm/approvals/[id] - Get single approval detail
 * PUT /api/admin/crm/approvals/[id] - Approve or reject an approval request
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';
import { ApprovalStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const approvalActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().max(2000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// GET: Single approval detail
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;

    const approval = await prisma.crmApproval.findUnique({
      where: { id },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } },
      },
    });

    if (!approval) {
      return apiError('Approval not found', ErrorCode.RESOURCE_NOT_FOUND, {
        status: 404,
        request,
      });
    }

    return apiSuccess(approval, { request });
  } catch (error) {
    logger.error('[crm/approvals/[id]] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch approval', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.leads.view' });

// ---------------------------------------------------------------------------
// PUT: Approve or reject an approval request
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (
  request: NextRequest,
  { session, params }: { session: { user: { id: string } }; params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = approvalActionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid input. Provide { action: "approve" | "reject", note?: string }', ErrorCode.VALIDATION_ERROR, {
        request,
        details: parsed.error.flatten(),
      });
    }

    const { action, note } = parsed.data;

    // Verify approval exists and is still pending
    const existing = await prisma.crmApproval.findUnique({
      where: { id },
    });

    if (!existing) {
      return apiError('Approval not found', ErrorCode.RESOURCE_NOT_FOUND, {
        status: 404,
        request,
      });
    }

    if (existing.status !== ApprovalStatus.PENDING) {
      return apiError(
        `Approval has already been ${existing.status.toLowerCase()}`,
        ErrorCode.CONFLICT,
        { status: 409, request }
      );
    }

    // Prevent self-approval
    if (existing.requestedById === session.user.id) {
      return apiError(
        'You cannot approve or reject your own request',
        ErrorCode.FORBIDDEN,
        { status: 403, request }
      );
    }

    // Build update data based on action
    const now = new Date();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      approverId: session.user.id,
    };

    if (action === 'approve') {
      updateData.status = ApprovalStatus.APPROVED;
      updateData.approvedAt = now;
    } else {
      updateData.status = ApprovalStatus.REJECTED;
      updateData.rejectedAt = now;
      updateData.rejectionNote = note ?? null;
    }

    const updated = await prisma.crmApproval.update({
      where: { id },
      data: updateData,
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } },
      },
    });

    logger.info(`[crm/approvals/[id]] Approval ${action}d`, {
      approvalId: updated.id,
      entityType: updated.entityType,
      entityId: updated.entityId,
      action,
      approvedBy: session.user.id,
    });

    return apiSuccess(updated, { request });
  } catch (error) {
    logger.error('[crm/approvals/[id]] PUT error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to process approval action', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.leads.edit' });

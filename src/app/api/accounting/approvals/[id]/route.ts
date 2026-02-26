export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';
import {
  approveRequest,
  rejectRequest,
} from '@/lib/accounting/workflow-engine.service';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const approvalActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/approvals/[id] - Approval details
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest, { params }) => {
  try {
    const { id } = params;

    const approval = await prisma.approvalRequest.findUnique({
      where: { id },
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

    // Fetch the associated workflow rule for context
    let rule = null;
    if (approval.workflowRuleId) {
      rule = await prisma.workflowRule.findUnique({
        where: { id: approval.workflowRuleId },
        select: { id: true, name: true, description: true, entityType: true },
      });
    }

    return apiSuccess(
      {
        ...approval,
        amount: approval.amount ? Number(approval.amount) : null,
        workflowRule: rule,
      },
      { request },
    );
  } catch (error) {
    logger.error('Error fetching approval request', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Error fetching approval request', 'INTERNAL_ERROR', {
      status: 500,
      request,
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/approvals/[id] - Approve or reject
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { params, session }) => {
  try {
    const { id } = params;

    const body = await request.json();
    const parsed = approvalActionSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('Invalid data', 'VALIDATION_ERROR', {
        status: 400,
        details: parsed.error.flatten().fieldErrors,
        request,
      });
    }

    const { action, note } = parsed.data;
    const userId = session.user?.email || session.user?.id || 'unknown';

    if (action === 'approve') {
      const result = await approveRequest(id, userId, note);
      if (!result.success) {
        return apiError(result.error || 'Approval failed', 'VALIDATION_ERROR', {
          status: 400,
          request,
        });
      }
      return apiSuccess({ message: 'Approval granted', requestId: id }, { request });
    } else {
      // reject
      if (!note) {
        return apiError('A note is required when rejecting', 'VALIDATION_ERROR', {
          status: 400,
          request,
        });
      }
      const result = await rejectRequest(id, userId, note);
      if (!result.success) {
        return apiError(result.error || 'Rejection failed', 'VALIDATION_ERROR', {
          status: 400,
          request,
        });
      }
      return apiSuccess({ message: 'Approval rejected', requestId: id }, { request });
    }
  } catch (error) {
    logger.error('Error processing approval action', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Error processing approval action', 'INTERNAL_ERROR', {
      status: 500,
      request,
    });
  }
});

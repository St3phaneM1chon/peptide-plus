export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { apiPaginated, apiError } from '@/lib/api-response';

// ---------------------------------------------------------------------------
// GET /api/accounting/approvals - List approval requests
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const entityType = searchParams.get('entityType');
    const assignedTo = searchParams.get('assignedTo');
    const assignedRole = searchParams.get('assignedRole');
    const requestedBy = searchParams.get('requestedBy');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20') || 20), 200);

    // Build where clause
    const where: Prisma.ApprovalRequestWhereInput = {};
    if (status) where.status = status;
    if (entityType) where.entityType = entityType;
    if (assignedTo) where.assignedTo = assignedTo;
    if (assignedRole) where.assignedRole = assignedRole;
    if (requestedBy) where.requestedBy = requestedBy;

    // Auto-expire overdue PENDING requests
    const now = new Date();
    const expiredPending = await prisma.approvalRequest.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now },
      },
      select: { id: true },
    });

    if (expiredPending.length > 0) {
      await prisma.approvalRequest.updateMany({
        where: {
          id: { in: expiredPending.map((r) => r.id) },
        },
        data: { status: 'EXPIRED' },
      });
    }

    const [requests, total] = await Promise.all([
      prisma.approvalRequest.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.approvalRequest.count({ where }),
    ]);

    // Map Decimal to number for JSON serialization
    const mapped = requests.map((r) => ({
      ...r,
      amount: r.amount ? Number(r.amount) : null,
    }));

    return apiPaginated(mapped, page, limit, total, { request });
  } catch (error) {
    logger.error('Error fetching approval requests', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Error fetching approval requests', 'INTERNAL_ERROR', {
      status: 500,
      request,
    });
  }
});

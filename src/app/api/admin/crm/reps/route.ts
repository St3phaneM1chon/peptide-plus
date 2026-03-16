export const dynamic = 'force-dynamic';

/**
 * Sales Rep 360° Dashboard - Reps List
 * GET /api/admin/crm/reps - List all reps (EMPLOYEE / OWNER users)
 */

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiPaginated, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// GET: List reps with counts
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest, { session }: { session: { user: { id: string } }; params?: Promise<{ id: string }> }) => {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  try {
    // Build where clause: only EMPLOYEE and OWNER roles
    const where: Prisma.UserWhereInput = {
      role: { in: ['EMPLOYEE', 'OWNER'] },
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [reps, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              assignedLeads: true,
              assignedDeals: true,
              crmActivities: true,
              agentDailyStats: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return apiPaginated(reps, page, limit, total, { request });
  } catch (error) {
    logger.error('Failed to list reps', {
      event: 'reps_list_error',
      error: error instanceof Error ? error.message : String(error),
      userId: session.user?.id,
    });
    return apiError('Failed to list reps', ErrorCode.INTERNAL_ERROR, {
      status: 500,
      request,
    });
  }
}, { requiredPermission: 'crm.reports.view' });

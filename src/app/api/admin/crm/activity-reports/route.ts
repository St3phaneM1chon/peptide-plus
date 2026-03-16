export const dynamic = 'force-dynamic';

/**
 * Activity Reports API (J16)
 * GET /api/admin/crm/activity-reports - Agent activity breakdown
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ErrorCode } from '@/lib/error-codes';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const querySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  agentId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GET: Agent activity breakdown
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      agentId: searchParams.get('agentId') || undefined,
    });

    if (!parsed.success) {
      return apiError('Invalid parameters', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
    }

    const { dateFrom, dateTo, agentId } = parsed.data;

    // Default to last 7 days
    const now = new Date();
    const start = dateFrom ? new Date(dateFrom) : new Date(now.getTime() - 7 * 86400000);
    const end = dateTo ? new Date(dateTo + 'T23:59:59Z') : now;

    const where: Prisma.CrmActivityWhereInput = {
      createdAt: { gte: start, lte: end },
      ...(agentId ? { performedById: agentId } : {}),
    };

    // Fetch all activities in range
    const activities = await prisma.crmActivity.findMany({
      where,
      select: {
        type: true,
        performedById: true,
        createdAt: true,
        performedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by agent
    const agentMap = new Map<string, {
      name: string; email: string;
      CALL: number; EMAIL: number; SMS: number; MEETING: number; NOTE: number;
      STATUS_CHANGE: number; DEAL_CREATED: number; DEAL_WON: number; DEAL_LOST: number;
      total: number;
    }>();

    for (const a of activities) {
      const aid = a.performedById || 'unknown';
      const entry = agentMap.get(aid) || {
        name: a.performedBy?.name || 'Unknown',
        email: a.performedBy?.email || '',
        CALL: 0, EMAIL: 0, SMS: 0, MEETING: 0, NOTE: 0,
        STATUS_CHANGE: 0, DEAL_CREATED: 0, DEAL_WON: 0, DEAL_LOST: 0,
        total: 0,
      };
      (entry as Record<string, unknown>)[a.type] = ((entry as Record<string, unknown>)[a.type] as number || 0) + 1;
      entry.total++;
      agentMap.set(aid, entry);
    }

    const agents = Array.from(agentMap.entries()).map(([id, data]) => ({
      agentId: id,
      ...data,
    })).sort((a, b) => b.total - a.total);

    // Daily summary
    const dailyMap = new Map<string, { date: string; count: number }>();
    for (const a of activities) {
      const dateKey = a.createdAt.toISOString().slice(0, 10);
      const entry = dailyMap.get(dateKey) || { date: dateKey, count: 0 };
      entry.count++;
      dailyMap.set(dateKey, entry);
    }

    const dailySummary = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return apiSuccess({
      dateRange: { from: start.toISOString(), to: end.toISOString() },
      totalActivities: activities.length,
      agents,
      dailySummary,
    }, { request });
  } catch (error) {
    logger.error('[crm/activity-reports] GET error', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to fetch activity reports', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.reports.view', skipCsrf: true });

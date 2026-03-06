export const dynamic = 'force-dynamic';

/**
 * Customer CRM Data API
 * GET /api/admin/customers/[id]/crm — Get CRM data (deals, activities, tasks, inbox) for a customer
 */

import { NextRequest } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';
import { Decimal } from '@prisma/client/runtime/library';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decimalToNumber(val: unknown): number {
  if (val instanceof Decimal) return val.toNumber();
  if (typeof val === 'number') return val;
  return Number(val) || 0;
}

// ---------------------------------------------------------------------------
// GET: Customer CRM data
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: userId } = await params;

    // 1. Check feature flag ff.crm_module
    const ffCrm = await prisma.siteSetting.findUnique({
      where: { key: 'ff.crm_module' },
      select: { value: true },
    });
    if (ffCrm?.value === 'false') {
      return apiSuccess({ enabled: false }, { request });
    }

    // 2. Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return apiError('User not found', ErrorCode.NOT_FOUND, { request });
    }

    // 3. Fetch CRM data in parallel (contactId = userId)
    const [deals, activities, tasks, inboxConversations, pendingTaskCount] = await Promise.all([
      prisma.crmDeal.findMany({
        where: { contactId: userId },
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          stage: { select: { id: true, name: true, color: true, probability: true, isWon: true, isLost: true } },
          pipeline: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.crmActivity.findMany({
        where: { contactId: userId },
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          performedBy: { select: { id: true, name: true, email: true } },
          deal: { select: { id: true, title: true } },
        },
      }),
      prisma.crmTask.findMany({
        where: { contactId: userId },
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedTo: { select: { id: true, name: true, email: true } },
          deal: { select: { id: true, title: true } },
        },
      }),
      prisma.inboxConversation.findMany({
        where: { contactId: userId },
        take: 20,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          messages: { take: 2, orderBy: { createdAt: 'desc' } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.crmTask.count({
        where: {
          contactId: userId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      }),
    ]);

    // 4. Calculate summary
    const wonDeals = deals.filter(d => d.stage.isWon);
    const lostDeals = deals.filter(d => d.stage.isLost);
    const openDeals = deals.filter(d => !d.stage.isWon && !d.stage.isLost);
    const totalDealValue = deals.reduce((sum, d) => sum + decimalToNumber(d.value), 0);
    const wonDealValue = wonDeals.reduce((sum, d) => sum + decimalToNumber(d.value), 0);
    const closedCount = wonDeals.length + lostDeals.length;
    const winRate = closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : 0;

    // Last contacted (most recent activity)
    const lastContacted = activities.length > 0 ? activities[0].createdAt : null;

    // Next task due
    const pendingTasks = tasks
      .filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS')
      .filter(t => t.dueAt != null)
      .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime());
    const nextTaskDue = pendingTasks.length > 0 ? pendingTasks[0].dueAt : null;

    const summary = {
      totalDeals: deals.length,
      wonCount: wonDeals.length,
      lostCount: lostDeals.length,
      openCount: openDeals.length,
      totalDealValue,
      wonDealValue,
      winRate,
      pendingTaskCount,
      lastContacted,
      nextTaskDue,
    };

    // 5. Convert Decimal values in deals
    const serializedDeals = deals.map(d => ({
      ...d,
      value: decimalToNumber(d.value),
    }));

    // 6. Return
    return apiSuccess({
      enabled: true,
      summary,
      deals: serializedDeals,
      activities,
      tasks,
      inboxConversations,
    }, { request });
  } catch (error) {
    logger.error('[customers/[id]/crm] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch CRM data', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { skipCsrf: true });

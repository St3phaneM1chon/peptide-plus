export const dynamic = 'force-dynamic';

/**
 * CRM Workflow Analytics API (I14)
 * GET /api/admin/crm/workflow-analytics - Workflow execution statistics
 *
 * Returns aggregated metrics: total executions, success/fail rates,
 * average duration, per-workflow breakdown, and recent errors.
 * Supports date range filtering via ?from=&to= query params.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Query schema
// ---------------------------------------------------------------------------

const querySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// ---------------------------------------------------------------------------
// GET: Workflow execution statistics
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
    });

    // Date range filter
    const dateFilter: { startedAt?: { gte?: Date; lte?: Date } } = {};
    if (parsed.success) {
      if (parsed.data.from || parsed.data.to) {
        dateFilter.startedAt = {};
        if (parsed.data.from) dateFilter.startedAt.gte = new Date(parsed.data.from);
        if (parsed.data.to) dateFilter.startedAt.lte = new Date(parsed.data.to);
      }
    }

    // Fetch all executions in range
    const executions = await prisma.crmWorkflowExecution.findMany({
      where: dateFilter,
      select: {
        id: true,
        workflowId: true,
        status: true,
        startedAt: true,
        completedAt: true,
        error: true,
        workflow: { select: { id: true, name: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Aggregate totals
    const total = executions.length;
    const completed = executions.filter(e => e.status === 'COMPLETED').length;
    const failed = executions.filter(e => e.status === 'FAILED').length;
    const running = executions.filter(e => e.status === 'RUNNING').length;
    const cancelled = executions.filter(e => e.status === 'CANCELLED').length;

    const successRate = total > 0 ? Math.round((completed / total) * 10000) / 100 : 0;
    const failureRate = total > 0 ? Math.round((failed / total) * 10000) / 100 : 0;

    // Average duration (only for completed executions with completedAt)
    const durations = executions
      .filter(e => e.completedAt && e.startedAt)
      .map(e => new Date(e.completedAt!).getTime() - new Date(e.startedAt).getTime());
    const avgDurationMs = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    // Per-workflow breakdown
    const byWorkflow = new Map<string, {
      workflowId: string;
      workflowName: string;
      total: number;
      completed: number;
      failed: number;
      running: number;
      avgDurationMs: number;
    }>();

    for (const exec of executions) {
      const key = exec.workflowId;
      if (!byWorkflow.has(key)) {
        byWorkflow.set(key, {
          workflowId: key,
          workflowName: exec.workflow?.name ?? 'Unknown',
          total: 0,
          completed: 0,
          failed: 0,
          running: 0,
          avgDurationMs: 0,
        });
      }
      const entry = byWorkflow.get(key)!;
      entry.total++;
      if (exec.status === 'COMPLETED') entry.completed++;
      if (exec.status === 'FAILED') entry.failed++;
      if (exec.status === 'RUNNING') entry.running++;
    }

    // Calculate per-workflow avg duration
    for (const [key, entry] of byWorkflow) {
      const wfDurations = executions
        .filter(e => e.workflowId === key && e.completedAt && e.startedAt)
        .map(e => new Date(e.completedAt!).getTime() - new Date(e.startedAt).getTime());
      entry.avgDurationMs = wfDurations.length > 0
        ? Math.round(wfDurations.reduce((a, b) => a + b, 0) / wfDurations.length)
        : 0;
    }

    // Recent errors (last 20)
    const recentErrors = executions
      .filter(e => e.status === 'FAILED')
      .slice(0, 20)
      .map(e => ({
        executionId: e.id,
        workflowId: e.workflowId,
        workflowName: e.workflow?.name ?? 'Unknown',
        error: e.error || 'Unknown error',
        startedAt: e.startedAt,
        completedAt: e.completedAt,
      }));

    const data = {
      summary: {
        total,
        completed,
        failed,
        running,
        cancelled,
        successRate,
        failureRate,
        avgDurationMs,
      },
      byWorkflow: Array.from(byWorkflow.values()),
      recentErrors,
    };

    return apiSuccess(data, { request });
  } catch (error) {
    logger.error('[crm/workflow-analytics] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('Failed to fetch workflow analytics', ErrorCode.INTERNAL_ERROR, { request });
  }
}, { requiredPermission: 'crm.workflows.manage' });

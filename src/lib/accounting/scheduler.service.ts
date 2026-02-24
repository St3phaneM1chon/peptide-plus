/**
 * Scheduler Service - Phase 8: Automation
 *
 * NOT an actual cron daemon. This is a serverless-friendly orchestrator
 * designed to be invoked from an API endpoint (e.g. POST /api/accounting/cron)
 * triggered by an external scheduler (Azure App Service cron, GitHub Actions, etc.).
 *
 * Tasks executed:
 *   1. Process recurring entries (subscriptions, depreciation)
 *   2. Evaluate alert rules (budgets, overdue invoices, reconciliation gaps)
 *   3. Run auto-reconciliation (match bank txs to journal entries)
 */

import { processRecurringEntries } from './recurring-entries.service';
import { evaluateAlertRules } from './alert-rules.service';
import { runAutoReconciliation } from './auto-reconciliation.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScheduledTaskResult {
  task: string;
  success: boolean;
  duration: number; // ms
  details: Record<string, unknown>;
  error?: string;
}

export interface SchedulerRunResult {
  startedAt: string;
  completedAt: string;
  totalDuration: number; // ms
  tasks: ScheduledTaskResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// F064 FIX: Add per-task timeout to prevent one task from blocking all others
const TASK_TIMEOUT_MS = 300_000; // 5 minutes

async function runTask(
  name: string,
  fn: () => Promise<Record<string, unknown>>
): Promise<ScheduledTaskResult> {
  const start = Date.now();
  try {
    const details = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Task '${name}' timed out after ${TASK_TIMEOUT_MS}ms`)), TASK_TIMEOUT_MS)
      ),
    ]);
    return {
      task: name,
      success: true,
      duration: Date.now() - start,
      details,
    };
  } catch (error) {
    console.error('[Scheduler] Task execution failed:', name, error);
    return {
      task: name,
      success: false,
      duration: Date.now() - start,
      details: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute all scheduled accounting tasks.
 *
 * Call this from an API endpoint guarded by API key authentication.
 * Tasks run sequentially to avoid overwhelming the database.
 * FIX: F089 - TODO: Persist SchedulerRunResult in a dedicated DB table for execution history
 */
export async function runScheduledTasks(): Promise<SchedulerRunResult> {
  const startedAt = new Date();
  const tasks: ScheduledTaskResult[] = [];

  // 1. Process recurring entries
  tasks.push(
    await runTask('recurring-entries', async () => {
      const result = await processRecurringEntries();
      return result as unknown as Record<string, unknown>;
    })
  );

  // 2. Evaluate alert rules
  tasks.push(
    await runTask('alert-rules', async () => {
      const result = await evaluateAlertRules();
      return {
        evaluated: result.evaluated,
        alertsCreated: result.alertsCreated,
        totalAlerts: result.alerts.length,
      };
    })
  );

  // 3. Run auto-reconciliation
  tasks.push(
    await runTask('auto-reconciliation', async () => {
      const result = await runAutoReconciliation();
      return {
        processed: result.processed,
        autoMatched: result.autoMatched,
        suggested: result.suggested,
        errors: result.errors.length,
      };
    })
  );

  const completedAt = new Date();
  const succeeded = tasks.filter((t) => t.success).length;
  const failed = tasks.filter((t) => !t.success).length;

  return {
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    totalDuration: completedAt.getTime() - startedAt.getTime(),
    tasks,
    summary: {
      total: tasks.length,
      succeeded,
      failed,
    },
  };
}

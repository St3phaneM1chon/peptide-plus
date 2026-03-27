export const dynamic = 'force-dynamic';

/**
 * CRON Job - Workflow Automation Engine
 * GET /api/cron/workflow-automation
 *
 * Runs every 5 minutes. Checks active Workflow rules for pending triggers,
 * evaluates conditions, and executes matching actions:
 *   - SEND_EMAIL: send notification email
 *   - UPDATE_STATUS: change order/deal status
 *   - ADD_TAG: add tag to user/lead
 *   - CREATE_TASK: create a CRM task
 *   - WEBHOOK: fire an HTTP webhook
 *
 * Uses the Workflow + WorkflowRun + WorkflowStep models from system.prisma.
 * Protected by CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/email-service';
import { withJobLock } from '@/lib/cron-lock';
import { logger } from '@/lib/logger';

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get('authorization');
  const provided = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  try {
    const a = Buffer.from(cronSecret, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

interface ActionParams {
  type: string;
  to?: string;
  subject?: string;
  body?: string;
  status?: string;
  tag?: string;
  taskTitle?: string;
  taskDescription?: string;
  assignedToId?: string;
  url?: string;
  entityType?: string;
  entityId?: string;
}

async function executeAction(
  action: ActionParams,
  triggerData: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (action.type) {
      case 'SEND_EMAIL': {
        if (!action.to || !action.subject) {
          return { success: false, error: 'Missing to or subject' };
        }
        const result = await sendEmail({
          to: { email: action.to },
          subject: action.subject,
          html: action.body || `<p>${action.subject}</p>`,
          tags: ['workflow-automation'],
        });
        return { success: result.success, error: result.error };
      }

      case 'UPDATE_STATUS': {
        const eType = action.entityType || (triggerData.entityType as string);
        const eId = action.entityId || (triggerData.entityId as string);
        const newStatus = action.status;
        if (!eType || !eId || !newStatus) {
          return { success: false, error: 'Missing entityType, entityId, or status' };
        }
        if (eType === 'ORDER') {
          await prisma.order.update({ where: { id: eId }, data: { status: newStatus } });
        } else if (eType === 'CRM_DEAL') {
          await prisma.crmDeal.update({
            where: { id: eId },
            data: { tags: { push: `auto:${newStatus}` } },
          });
        }
        return { success: true };
      }

      case 'ADD_TAG': {
        const tag = action.tag;
        const userId = triggerData.userId as string | undefined;
        if (!tag || !userId) return { success: false, error: 'Missing tag or userId' };
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { tags: true } });
        if (user && !user.tags.includes(tag)) {
          await prisma.user.update({ where: { id: userId }, data: { tags: { push: tag } } });
        }
        return { success: true };
      }

      case 'CREATE_TASK': {
        if (!action.assignedToId) {
          return { success: false, error: 'assignedToId required for CREATE_TASK' };
        }
        await prisma.crmTask.create({
          data: {
            title: action.taskTitle || 'Auto-generated task',
            description: action.taskDescription || '',
            status: 'PENDING',
            priority: 'MEDIUM',
            dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            assignedToId: action.assignedToId,
          },
        });
        return { success: true };
      }

      case 'WEBHOOK': {
        if (!action.url) return { success: false, error: 'Missing webhook url' };
        const response = await fetch(action.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(triggerData),
          signal: AbortSignal.timeout(10000),
        });
        return { success: response.ok, error: response.ok ? undefined : `HTTP ${response.status}` };
      }

      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function evaluateConditions(
  conditions: Array<{ field: string; operator: string; value: unknown }>,
  data: Record<string, unknown>
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((cond) => {
    const actual = data[cond.field];
    switch (cond.operator) {
      case 'equals': return actual === cond.value;
      case 'not_equals': return actual !== cond.value;
      case 'contains': return typeof actual === 'string' && actual.includes(String(cond.value));
      case 'gt': return typeof actual === 'number' && actual > Number(cond.value);
      case 'lt': return typeof actual === 'number' && actual < Number(cond.value);
      case 'gte': return typeof actual === 'number' && actual >= Number(cond.value);
      case 'lte': return typeof actual === 'number' && actual <= Number(cond.value);
      case 'in': return Array.isArray(cond.value) && (cond.value as unknown[]).includes(actual);
      default: return false;
    }
  });
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withJobLock('workflow-automation', async () => {
    const startTime = Date.now();
    let executed = 0;
    let failed = 0;

    try {
      const workflows = await prisma.workflow.findMany({
        where: { isActive: true },
        take: 50,
      });

      if (workflows.length === 0) {
        return NextResponse.json({ success: true, executed: 0, message: 'No active workflows' });
      }

      for (const workflow of workflows) {
        try {
          const conditions = (workflow.conditions as Array<{ field: string; operator: string; value: unknown }>) || [];
          const actions = workflow.actions as unknown as ActionParams[];
          if (!actions || actions.length === 0) continue;

          let entities: Array<{ id: string; data: Record<string, unknown> }> = [];
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
          const lastRun = workflow.lastRunAt || new Date(0);
          const checkSince = lastRun > fiveMinAgo ? lastRun : fiveMinAgo;

          switch (workflow.trigger) {
            case 'ORDER_CREATED': {
              const orders = await prisma.order.findMany({
                where: { createdAt: { gte: checkSince } },
                select: { id: true, status: true, total: true, userId: true },
                take: 50,
              });
              entities = orders.map((o) => ({
                id: o.id,
                data: { entityType: 'ORDER' as const, entityId: o.id, status: o.status, total: Number(o.total), userId: o.userId ?? '' },
              }));
              break;
            }
            case 'ORDER_PAID': {
              const orders = await prisma.order.findMany({
                where: { paymentStatus: 'PAID', updatedAt: { gte: checkSince } },
                select: { id: true, status: true, total: true, userId: true },
                take: 50,
              });
              entities = orders.map((o) => ({
                id: o.id,
                data: { entityType: 'ORDER' as const, entityId: o.id, status: o.status, total: Number(o.total), userId: o.userId ?? '' },
              }));
              break;
            }
            case 'USER_REGISTERED': {
              const users = await prisma.user.findMany({
                where: { createdAt: { gte: checkSince } },
                select: { id: true, email: true, name: true, role: true },
                take: 50,
              });
              entities = users.map((u) => ({
                id: u.id,
                data: { entityType: 'USER' as const, entityId: u.id, email: u.email, name: u.name ?? '', role: u.role },
              }));
              break;
            }
            case 'CART_ABANDONED': {
              const carts = await prisma.cart.findMany({
                where: {
                  userId: { not: null },
                  updatedAt: { gte: new Date(checkSince.getTime() - 60 * 60 * 1000), lte: checkSince },
                  items: { some: {} },
                },
                select: { id: true, userId: true },
                take: 50,
              });
              entities = carts.map((c) => ({
                id: c.id,
                data: { entityType: 'CART' as const, entityId: c.id, userId: c.userId ?? '' },
              }));
              break;
            }
            default:
              continue;
          }

          for (const entity of entities) {
            if (!evaluateConditions(conditions, entity.data)) continue;

            const existingRun = await prisma.workflowRun.findFirst({
              where: { workflowId: workflow.id, triggeredBy: entity.id, startedAt: { gte: fiveMinAgo } },
              select: { id: true },
            });
            if (existingRun) continue;

            const run = await prisma.workflowRun.create({
              data: {
                workflowId: workflow.id,
                triggeredBy: entity.id,
                triggerData: entity.data as Record<string, string | number | boolean | null>,
                status: 'RUNNING',
              },
            });

            let allOk = true;

            for (let i = 0; i < actions.length; i++) {
              const step = await prisma.workflowStep.create({
                data: {
                  runId: run.id,
                  stepIndex: i,
                  actionType: actions[i].type,
                  actionData: JSON.parse(JSON.stringify(actions[i])),
                  status: 'RUNNING',
                  startedAt: new Date(),
                },
              });

              const result = await executeAction(actions[i], entity.data);

              await prisma.workflowStep.update({
                where: { id: step.id },
                data: {
                  status: result.success ? 'COMPLETED' : 'FAILED',
                  result: { success: result.success, error: result.error ?? null },
                  completedAt: new Date(),
                  error: result.error || undefined,
                },
              });

              if (result.success) executed++;
              else { allOk = false; failed++; }
            }

            await prisma.workflowRun.update({
              where: { id: run.id },
              data: { status: allOk ? 'COMPLETED' : 'FAILED', completedAt: new Date() },
            });
          }

          await prisma.workflow.update({
            where: { id: workflow.id },
            data: { lastRunAt: new Date(), runCount: { increment: 1 } },
          });
        } catch (err) {
          logger.error('[CRON:WORKFLOW] Error processing workflow', {
            workflowId: workflow.id,
            error: err instanceof Error ? err.message : String(err),
          });
          failed++;
        }
      }

      const durationMs = Date.now() - startTime;
      logger.info('[CRON:WORKFLOW] Completed', { executed, failed, durationMs });

      return NextResponse.json({
        success: true,
        activeWorkflows: workflows.length,
        executed,
        failed,
        durationMs,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[CRON:WORKFLOW] Fatal error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export { GET as POST };

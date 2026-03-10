/**
 * CRM Workflow Automation Engine
 *
 * Event-driven workflow engine supporting triggers (deal stage change, lead status change,
 * score threshold, new lead/deal, time-based) and actions (send email/SMS, create task,
 * update field, notify agent, webhook, assign, move stage, tag management).
 *
 * Advanced capabilities (Phase 4D):
 * - I6:  Parallel execution paths (PARALLEL action type)
 * - I7:  Loop/iteration over collections (LOOP action type)
 * - I8:  Error handling with retry, skip, abort, fallback
 * - I10: Cross-object automation chains
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type {
  WorkflowTriggerType,
  WorkflowActionType,
  CrmWorkflow,
  CrmWorkflowStep,
} from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkflowTriggerEvent {
  type: WorkflowTriggerType;
  entityType: 'lead' | 'deal';
  entityId: string;
  data?: Record<string, unknown>; // e.g. { fromStageId, toStageId, newScore, ... }
  userId?: string; // who triggered the event
  /** For cross-object chains: the originating event name */
  sourceEvent?: string;
}

interface StepConfig {
  // SEND_EMAIL
  templateId?: string;
  subject?: string;
  body?: string;
  to?: string; // 'lead_email' | 'agent_email' | specific email
  // SEND_SMS
  phone?: string; // 'lead_phone' | specific number
  message?: string;
  // CREATE_TASK
  taskTitle?: string;
  taskType?: string;
  taskPriority?: string;
  taskDueDays?: number;
  // UPDATE_FIELD
  fieldName?: string;
  fieldValue?: unknown;
  // NOTIFY_AGENT
  notificationMessage?: string;
  notifyAssignee?: boolean;
  notifyUserIds?: string[];
  // WEBHOOK
  webhookUrl?: string;
  webhookMethod?: string;
  webhookHeaders?: Record<string, string>;
  webhookBody?: Record<string, unknown>;
  // ASSIGN_TO
  assignToUserId?: string;
  assignRoundRobin?: boolean;
  // MOVE_STAGE
  targetStageId?: string;
  // ADD_TAG / REMOVE_TAG
  tag?: string;
  // WAIT
  waitMinutes?: number;
  // PARALLEL (I6)
  branches?: Array<{ steps: Array<{ actionType: string; config: Record<string, unknown>; delayMinutes?: number }> }>;
  // LOOP (I7)
  collectionSource?: string; // e.g. 'deal.products', 'lead.tags'
  loopBody?: Array<{ actionType: string; config: Record<string, unknown>; delayMinutes?: number }>;
  maxIterations?: number;
  // ERROR_HANDLER (I8)
  errorStrategy?: 'retry' | 'skip' | 'abort' | 'fallback';
  maxRetries?: number;
  retryBackoffMs?: number;
  fallbackSteps?: Array<{ actionType: string; config: Record<string, unknown> }>;
  // CROSS_OBJECT (I10)
  crossObjectChain?: Array<{
    event: string; // e.g. 'DEAL_CREATED', 'INVOICE_GENERATED'
    entityType: 'lead' | 'deal';
    actionType: string;
    config: Record<string, unknown>;
  }>;
}

interface TriggerConfig {
  // DEAL_STAGE_CHANGE
  fromStageId?: string;
  toStageId?: string;
  pipelineId?: string;
  // LEAD_STATUS_CHANGE
  fromStatus?: string;
  toStatus?: string;
  // LEAD_SCORE_THRESHOLD
  threshold?: number;
  direction?: 'above' | 'below';
  // TIME_BASED
  cronExpression?: string;
  // FORM_SUBMISSION
  formId?: string;
  // CROSS_OBJECT (I10)
  sourceEvent?: string;
}

interface ExecutionLog {
  stepPosition: number;
  actionType: string;
  status: 'success' | 'failed' | 'skipped';
  message?: string;
  timestamp: string;
  /** For parallel branches, logs per branch */
  branchLogs?: ExecutionLog[][];
  /** For loops, logs per iteration */
  iterationLogs?: ExecutionLog[];
}

// ---------------------------------------------------------------------------
// Trigger matching
// ---------------------------------------------------------------------------

function matchesTrigger(
  workflow: CrmWorkflow & { steps: CrmWorkflowStep[] },
  event: WorkflowTriggerEvent
): boolean {
  if (workflow.triggerType !== event.type) return false;
  if (workflow.status !== 'ACTIVE') return false;

  const config = (workflow.triggerConfig as TriggerConfig) || {};

  switch (event.type) {
    case 'DEAL_STAGE_CHANGE': {
      if (config.toStageId && config.toStageId !== event.data?.toStageId) return false;
      if (config.fromStageId && config.fromStageId !== event.data?.fromStageId) return false;
      if (config.pipelineId && config.pipelineId !== event.data?.pipelineId) return false;
      return true;
    }
    case 'LEAD_STATUS_CHANGE': {
      if (config.toStatus && config.toStatus !== event.data?.toStatus) return false;
      if (config.fromStatus && config.fromStatus !== event.data?.fromStatus) return false;
      return true;
    }
    case 'LEAD_SCORE_THRESHOLD': {
      const score = event.data?.newScore as number;
      if (config.direction === 'above' && score < (config.threshold || 0)) return false;
      if (config.direction === 'below' && score > (config.threshold || 0)) return false;
      return true;
    }
    case 'NEW_LEAD':
    case 'NEW_DEAL':
    case 'MANUAL':
    case 'FORM_SUBMISSION':
      return true;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Action executors
// ---------------------------------------------------------------------------

async function executeAction(
  step: CrmWorkflowStep,
  entityType: string,
  entityId: string,
  userId?: string
): Promise<{ success: boolean; message?: string }> {
  const config = (step.config as StepConfig) || {};

  try {
    switch (step.actionType as WorkflowActionType) {
      case 'SEND_EMAIL':
        return await executeSendEmail(config, entityType, entityId);
      case 'SEND_SMS':
        return await executeSendSms(config, entityType, entityId);
      case 'CREATE_TASK':
        return await executeCreateTask(config, entityType, entityId, userId);
      case 'UPDATE_FIELD':
        return await executeUpdateField(config, entityType, entityId);
      case 'NOTIFY_AGENT':
        return await executeNotifyAgent(config, entityType, entityId);
      case 'WEBHOOK':
        return await executeWebhook(config, entityType, entityId);
      case 'ASSIGN_TO':
        return await executeAssignTo(config, entityType, entityId);
      case 'MOVE_STAGE':
        return await executeMoveStage(config, entityId);
      case 'ADD_TAG':
        return await executeAddTag(config, entityType, entityId);
      case 'REMOVE_TAG':
        return await executeRemoveTag(config, entityType, entityId);
      case 'WAIT':
        return { success: true, message: `Wait ${config.waitMinutes || 0} minutes` };
      default:
        return { success: false, message: `Unknown action: ${step.actionType}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[WorkflowEngine] Action failed', { actionType: step.actionType, entityType, entityId, error: msg });
    return { success: false, message: msg };
  }
}

async function executeSendEmail(config: StepConfig, entityType: string, entityId: string) {
  const entity = entityType === 'lead'
    ? await prisma.crmLead.findUnique({ where: { id: entityId }, select: { email: true, contactName: true, assignedToId: true } })
    : await prisma.crmDeal.findUnique({ where: { id: entityId }, include: { lead: { select: { email: true, contactName: true } } } });

  if (!entity) return { success: false, message: 'Entity not found' };

  const email = entityType === 'lead'
    ? (entity as { email: string | null }).email
    : (entity as { lead: { email: string | null } | null }).lead?.email;

  if (!email) return { success: false, message: 'No email address' };

  // Log as activity instead of sending (email sending delegated to email service)
  await prisma.crmActivity.create({
    data: {
      type: 'EMAIL',
      title: config.subject || 'Automated email',
      description: config.body || 'Sent via workflow automation',
      ...(entityType === 'lead' ? { leadId: entityId } : { dealId: entityId }),
      performedById: (entity as { assignedToId?: string | null }).assignedToId || null,
      metadata: { automated: true, templateId: config.templateId } as unknown as Prisma.InputJsonValue,
    },
  });

  return { success: true, message: `Email queued to ${email}` };
}

async function executeSendSms(config: StepConfig, entityType: string, entityId: string) {
  const lead = entityType === 'lead'
    ? await prisma.crmLead.findUnique({ where: { id: entityId }, select: { phone: true } })
    : null;

  const phone = lead?.phone || config.phone;
  if (!phone) return { success: false, message: 'No phone number' };

  // Log SMS activity
  await prisma.crmActivity.create({
    data: {
      type: 'SMS',
      title: 'Automated SMS',
      description: config.message || 'Sent via workflow',
      ...(entityType === 'lead' ? { leadId: entityId } : { dealId: entityId }),
      metadata: { automated: true, phone } as unknown as Prisma.InputJsonValue,
    },
  });

  return { success: true, message: `SMS queued to ${phone}` };
}

async function executeCreateTask(config: StepConfig, entityType: string, entityId: string, userId?: string) {
  const entity = entityType === 'lead'
    ? await prisma.crmLead.findUnique({ where: { id: entityId }, select: { assignedToId: true } })
    : await prisma.crmDeal.findUnique({ where: { id: entityId }, select: { assignedToId: true } });

  const assigneeId = (entity as { assignedToId?: string | null })?.assignedToId || userId;
  if (!assigneeId) return { success: false, message: 'No assignee for task' };

  const dueAt = config.taskDueDays
    ? new Date(Date.now() + config.taskDueDays * 86400000)
    : new Date(Date.now() + 86400000); // default 1 day

  await prisma.crmTask.create({
    data: {
      title: config.taskTitle || 'Follow up',
      type: (config.taskType as 'CALL' | 'EMAIL' | 'MEETING' | 'FOLLOW_UP' | 'DEMO' | 'OTHER') || 'FOLLOW_UP',
      priority: (config.taskPriority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT') || 'MEDIUM',
      status: 'PENDING',
      dueAt,
      assignedToId: assigneeId,
      ...(entityType === 'lead' ? { leadId: entityId } : { dealId: entityId }),
    },
  });

  return { success: true, message: `Task created: ${config.taskTitle || 'Follow up'}` };
}

async function executeUpdateField(config: StepConfig, entityType: string, entityId: string) {
  if (!config.fieldName) return { success: false, message: 'No field name specified' };

  if (entityType === 'lead') {
    await prisma.crmLead.update({
      where: { id: entityId },
      data: { [config.fieldName]: config.fieldValue },
    });
  } else {
    await prisma.crmDeal.update({
      where: { id: entityId },
      data: { [config.fieldName]: config.fieldValue },
    });
  }

  return { success: true, message: `Updated ${config.fieldName}` };
}

async function executeNotifyAgent(config: StepConfig, entityType: string, entityId: string) {
  // Create a notification activity for the assigned agent
  const entity = entityType === 'lead'
    ? await prisma.crmLead.findUnique({ where: { id: entityId }, select: { assignedToId: true, contactName: true } })
    : await prisma.crmDeal.findUnique({ where: { id: entityId }, select: { assignedToId: true, title: true } });

  if (!entity) return { success: false, message: 'Entity not found' };

  const assigneeId = (entity as { assignedToId?: string | null }).assignedToId;
  if (!assigneeId) return { success: false, message: 'No agent assigned' };

  await prisma.crmActivity.create({
    data: {
      type: 'NOTE',
      title: 'Workflow Notification',
      description: config.notificationMessage || 'Action required',
      ...(entityType === 'lead' ? { leadId: entityId } : { dealId: entityId }),
      performedById: assigneeId,
      metadata: { automated: true, notification: true },
    },
  });

  return { success: true, message: `Agent notified` };
}

async function executeWebhook(config: StepConfig, entityType: string, entityId: string) {
  if (!config.webhookUrl) return { success: false, message: 'No webhook URL' };

  const payload = {
    entityType,
    entityId,
    timestamp: new Date().toISOString(),
    ...(config.webhookBody || {}),
  };

  const res = await fetch(config.webhookUrl, {
    method: config.webhookMethod || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.webhookHeaders || {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) return { success: false, message: `Webhook returned ${res.status}` };
  return { success: true, message: `Webhook sent to ${config.webhookUrl}` };
}

async function executeAssignTo(config: StepConfig, entityType: string, entityId: string) {
  let assignToId = config.assignToUserId;

  if (config.assignRoundRobin) {
    // Simple round-robin: find agent with fewest active leads/deals
    const agents = await prisma.user.findMany({
      where: { role: 'EMPLOYEE' },
      select: { id: true, _count: { select: { assignedLeads: { where: { status: { in: ['NEW', 'CONTACTED'] } } } } } },
      orderBy: { assignedLeads: { _count: 'asc' } },
      take: 1,
    });
    assignToId = agents[0]?.id;
  }

  if (!assignToId) return { success: false, message: 'No agent to assign to' };

  if (entityType === 'lead') {
    await prisma.crmLead.update({ where: { id: entityId }, data: { assignedToId: assignToId } });
  } else {
    await prisma.crmDeal.update({ where: { id: entityId }, data: { assignedToId: assignToId } });
  }

  return { success: true, message: `Assigned to ${assignToId}` };
}

async function executeMoveStage(config: StepConfig, entityId: string) {
  if (!config.targetStageId) return { success: false, message: 'No target stage' };

  const deal = await prisma.crmDeal.findUnique({ where: { id: entityId }, select: { stageId: true } });
  if (!deal) return { success: false, message: 'Deal not found' };

  await prisma.$transaction([
    prisma.crmDeal.update({
      where: { id: entityId },
      data: { stageId: config.targetStageId },
    }),
    prisma.crmDealStageHistory.create({
      data: {
        dealId: entityId,
        fromStageId: deal.stageId,
        toStageId: config.targetStageId,
        changedById: 'system',
      },
    }),
  ]);

  return { success: true, message: `Moved to stage ${config.targetStageId}` };
}

async function executeAddTag(config: StepConfig, entityType: string, entityId: string) {
  if (!config.tag) return { success: false, message: 'No tag specified' };

  if (entityType === 'lead') {
    const lead = await prisma.crmLead.findUnique({ where: { id: entityId }, select: { tags: true } });
    if (lead && !lead.tags.includes(config.tag)) {
      await prisma.crmLead.update({ where: { id: entityId }, data: { tags: [...lead.tags, config.tag] } });
    }
  } else {
    const deal = await prisma.crmDeal.findUnique({ where: { id: entityId }, select: { tags: true } });
    if (deal && !deal.tags.includes(config.tag)) {
      await prisma.crmDeal.update({ where: { id: entityId }, data: { tags: [...deal.tags, config.tag] } });
    }
  }

  return { success: true, message: `Tag "${config.tag}" added` };
}

async function executeRemoveTag(config: StepConfig, entityType: string, entityId: string) {
  if (!config.tag) return { success: false, message: 'No tag specified' };

  if (entityType === 'lead') {
    const lead = await prisma.crmLead.findUnique({ where: { id: entityId }, select: { tags: true } });
    if (lead) {
      await prisma.crmLead.update({ where: { id: entityId }, data: { tags: lead.tags.filter(t => t !== config.tag) } });
    }
  } else {
    const deal = await prisma.crmDeal.findUnique({ where: { id: entityId }, select: { tags: true } });
    if (deal) {
      await prisma.crmDeal.update({ where: { id: entityId }, data: { tags: deal.tags.filter(t => t !== config.tag) } });
    }
  }

  return { success: true, message: `Tag "${config.tag}" removed` };
}

// ---------------------------------------------------------------------------
// I6: Parallel execution paths
// ---------------------------------------------------------------------------

/**
 * Execute multiple branches simultaneously. Each branch is an independent array
 * of steps. All branches run in parallel via Promise.allSettled so a failure in
 * one branch does not block the others.
 */
export async function executeParallelPaths(
  executionId: string,
  branches: Array<{ steps: Array<{ actionType: string; config: Record<string, unknown>; delayMinutes?: number }> }>,
  entityType: string,
  entityId: string,
  userId?: string
): Promise<{ success: boolean; branchLogs: ExecutionLog[][] }> {
  const branchLogs: ExecutionLog[][] = [];

  const results = await Promise.allSettled(
    branches.map(async (branch, branchIdx) => {
      const logs: ExecutionLog[] = [];
      for (const [stepIdx, stepDef] of branch.steps.entries()) {
        const fakeStep = {
          id: `parallel-${branchIdx}-${stepIdx}`,
          workflowId: '',
          position: stepIdx,
          actionType: stepDef.actionType as WorkflowActionType,
          config: stepDef.config as Prisma.JsonValue,
          delayMinutes: stepDef.delayMinutes ?? 0,
          conditionJson: null as Prisma.JsonValue | null,
          createdAt: new Date(),
        } as CrmWorkflowStep;

        const result = await executeAction(fakeStep, entityType, entityId, userId);
        logs.push({
          stepPosition: stepIdx,
          actionType: stepDef.actionType,
          status: result.success ? 'success' : 'failed',
          message: result.message,
          timestamp: new Date().toISOString(),
        });
        if (!result.success) break;
      }
      return logs;
    })
  );

  let allSuccess = true;
  for (const result of results) {
    if (result.status === 'fulfilled') {
      branchLogs.push(result.value);
      if (result.value.some(l => l.status === 'failed')) allSuccess = false;
    } else {
      branchLogs.push([{
        stepPosition: 0,
        actionType: 'PARALLEL_BRANCH',
        status: 'failed',
        message: result.reason instanceof Error ? result.reason.message : String(result.reason),
        timestamp: new Date().toISOString(),
      }]);
      allSuccess = false;
    }
  }

  logger.info('[WorkflowEngine] Parallel paths executed', {
    executionId,
    branchCount: branches.length,
    success: allSuccess,
  });

  return { success: allSuccess, branchLogs };
}

// ---------------------------------------------------------------------------
// I7: Loop / iteration
// ---------------------------------------------------------------------------

export interface LoopConfig {
  /** Dot-path to the collection, e.g. 'deal.products', 'lead.tags' */
  collectionSource: string;
  /** Steps to execute for each item in the collection */
  body: Array<{ actionType: string; config: Record<string, unknown>; delayMinutes?: number }>;
  /** Safety limit to prevent runaway loops. Defaults to 100. */
  maxIterations?: number;
}

/**
 * Execute a set of steps once per item in a collection. The current item is
 * injected into each step's config under the key `_loopItem`.
 */
export async function executeLoop(
  executionId: string,
  config: LoopConfig,
  entityType: string,
  entityId: string,
  userId?: string
): Promise<{ success: boolean; iterationLogs: ExecutionLog[] }> {
  const maxIter = Math.min(config.maxIterations ?? 100, 100);
  const iterationLogs: ExecutionLog[] = [];

  // Resolve collection from entity
  const collection = await resolveCollection(config.collectionSource, entityType, entityId);
  if (!collection || collection.length === 0) {
    iterationLogs.push({
      stepPosition: 0,
      actionType: 'LOOP',
      status: 'skipped',
      message: `Empty collection: ${config.collectionSource}`,
      timestamp: new Date().toISOString(),
    });
    return { success: true, iterationLogs };
  }

  const items = collection.slice(0, maxIter);
  let allSuccess = true;

  for (const [iterIdx, item] of items.entries()) {
    for (const [stepIdx, stepDef] of config.body.entries()) {
      const enrichedConfig = { ...stepDef.config, _loopItem: item, _loopIndex: iterIdx };
      const fakeStep = {
        id: `loop-${iterIdx}-${stepIdx}`,
        workflowId: '',
        position: stepIdx,
        actionType: stepDef.actionType as WorkflowActionType,
        config: enrichedConfig as unknown as Prisma.JsonValue,
        delayMinutes: stepDef.delayMinutes ?? 0,
        conditionJson: null as Prisma.JsonValue | null,
        createdAt: new Date(),
      } as CrmWorkflowStep;

      const result = await executeAction(fakeStep, entityType, entityId, userId);
      iterationLogs.push({
        stepPosition: iterIdx * config.body.length + stepIdx,
        actionType: `LOOP[${iterIdx}].${stepDef.actionType}`,
        status: result.success ? 'success' : 'failed',
        message: result.message,
        timestamp: new Date().toISOString(),
      });
      if (!result.success) {
        allSuccess = false;
        break;
      }
    }
    if (!allSuccess) break;
  }

  logger.info('[WorkflowEngine] Loop executed', {
    executionId,
    collectionSource: config.collectionSource,
    iterations: items.length,
    success: allSuccess,
  });

  return { success: allSuccess, iterationLogs };
}

/** Resolve a dot-path collection from an entity (e.g. 'deal.products', 'lead.tags'). */
async function resolveCollection(
  source: string,
  entityType: string,
  entityId: string
): Promise<unknown[]> {
  try {
    if (source === 'lead.tags' && entityType === 'lead') {
      const lead = await prisma.crmLead.findUnique({ where: { id: entityId }, select: { tags: true } });
      return lead?.tags ?? [];
    }
    if (source === 'deal.tags' && entityType === 'deal') {
      const deal = await prisma.crmDeal.findUnique({ where: { id: entityId }, select: { tags: true } });
      return deal?.tags ?? [];
    }
    if (source === 'deal.products' && entityType === 'deal') {
      const deal = await prisma.crmDeal.findUnique({
        where: { id: entityId },
        select: { products: { select: { id: true, productId: true, quantity: true, unitPrice: true } } },
      });
      return deal?.products ?? [];
    }
    // Generic: try to resolve from entity custom fields
    const entity = entityType === 'lead'
      ? await prisma.crmLead.findUnique({ where: { id: entityId }, select: { customFields: true } })
      : await prisma.crmDeal.findUnique({ where: { id: entityId }, select: { customFields: true } });
    const fields = entity?.customFields as Record<string, unknown> | null;
    const parts = source.split('.');
    const fieldKey = parts[parts.length - 1];
    if (fields && Array.isArray(fields[fieldKey])) return fields[fieldKey] as unknown[];
    return [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// I8: Error handling
// ---------------------------------------------------------------------------

export interface ErrorHandlerConfig {
  strategy: 'retry' | 'skip' | 'abort' | 'fallback';
  maxRetries?: number;
  retryBackoffMs?: number;
  fallbackSteps?: Array<{ actionType: string; config: Record<string, unknown> }>;
}

/**
 * Handle a step error according to the configured strategy.
 * - retry: re-execute with exponential backoff up to maxRetries
 * - skip: log and continue
 * - abort: stop the entire workflow
 * - fallback: run alternative steps
 */
export async function handleStepError(
  executionId: string,
  stepId: string,
  error: Error | string,
  step: CrmWorkflowStep,
  entityType: string,
  entityId: string,
  userId?: string,
  handlerConfig?: ErrorHandlerConfig
): Promise<{ resolved: boolean; action: string; logs: ExecutionLog[] }> {
  const config = handlerConfig ?? {
    strategy: ((step.config as StepConfig)?.errorStrategy as ErrorHandlerConfig['strategy']) ?? 'abort',
    maxRetries: (step.config as StepConfig)?.maxRetries ?? 3,
    retryBackoffMs: (step.config as StepConfig)?.retryBackoffMs ?? 1000,
    fallbackSteps: (step.config as StepConfig)?.fallbackSteps,
  };

  const errorMsg = error instanceof Error ? error.message : String(error);
  const logs: ExecutionLog[] = [];

  switch (config.strategy) {
    case 'retry': {
      const maxRetries = Math.min(config.maxRetries ?? 3, 5);
      const baseBackoff = config.retryBackoffMs ?? 1000;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const backoff = baseBackoff * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, Math.min(backoff, 10000)));
        const result = await executeAction(step, entityType, entityId, userId);
        logs.push({
          stepPosition: step.position,
          actionType: step.actionType,
          status: result.success ? 'success' : 'failed',
          message: `Retry ${attempt}/${maxRetries}: ${result.message}`,
          timestamp: new Date().toISOString(),
        });
        if (result.success) {
          logger.info('[WorkflowEngine] Retry succeeded', { executionId, stepId, attempt });
          return { resolved: true, action: 'retry_success', logs };
        }
      }
      logger.warn('[WorkflowEngine] All retries exhausted', { executionId, stepId, maxRetries });
      return { resolved: false, action: 'retry_exhausted', logs };
    }

    case 'skip':
      logs.push({
        stepPosition: step.position,
        actionType: step.actionType,
        status: 'skipped',
        message: `Skipped after error: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      });
      logger.info('[WorkflowEngine] Step skipped', { executionId, stepId });
      return { resolved: true, action: 'skipped', logs };

    case 'fallback': {
      if (!config.fallbackSteps?.length) {
        return { resolved: false, action: 'no_fallback_defined', logs };
      }
      for (const [idx, fbStep] of config.fallbackSteps.entries()) {
        const fakeStep = {
          id: `fallback-${idx}`,
          workflowId: '',
          position: idx,
          actionType: fbStep.actionType as WorkflowActionType,
          config: fbStep.config as unknown as Prisma.JsonValue,
          delayMinutes: 0,
          conditionJson: null as Prisma.JsonValue | null,
          createdAt: new Date(),
        } as CrmWorkflowStep;

        const result = await executeAction(fakeStep, entityType, entityId, userId);
        logs.push({
          stepPosition: step.position,
          actionType: `FALLBACK.${fbStep.actionType}`,
          status: result.success ? 'success' : 'failed',
          message: result.message,
          timestamp: new Date().toISOString(),
        });
        if (!result.success) {
          return { resolved: false, action: 'fallback_failed', logs };
        }
      }
      logger.info('[WorkflowEngine] Fallback succeeded', { executionId, stepId });
      return { resolved: true, action: 'fallback_success', logs };
    }

    case 'abort':
    default:
      logs.push({
        stepPosition: step.position,
        actionType: step.actionType,
        status: 'failed',
        message: `Aborted: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      });
      return { resolved: false, action: 'aborted', logs };
  }
}

// ---------------------------------------------------------------------------
// I10: Cross-object automation chains
// ---------------------------------------------------------------------------

/**
 * Cross-object event mapping. Defines the chain of events that follow
 * a given trigger (e.g. Lead convert triggers deal creation, which triggers
 * invoice generation, which triggers email notification).
 */
const CROSS_OBJECT_CHAINS: Record<string, Array<{
  event: string;
  entityType: 'lead' | 'deal';
  description: string;
}>> = {
  LEAD_CONVERTED: [
    { event: 'DEAL_CREATED', entityType: 'deal', description: 'Lead convert -> Deal created' },
  ],
  DEAL_WON: [
    { event: 'INVOICE_GENERATED', entityType: 'deal', description: 'Deal won -> Invoice generated' },
    { event: 'WIN_NOTIFICATION', entityType: 'deal', description: 'Deal won -> Win notification' },
  ],
  INVOICE_GENERATED: [
    { event: 'CONFIRMATION_EMAIL', entityType: 'deal', description: 'Invoice -> Confirmation email' },
  ],
};

/**
 * Execute a cross-object automation chain. Given an initial trigger event
 * (e.g. LEAD_CONVERTED), cascades through related object workflows.
 */
export async function executeCrossObjectChain(
  triggerEvent: WorkflowTriggerEvent
): Promise<{ executed: number; chainLog: Array<{ event: string; entityType: string; success: boolean }> }> {
  const sourceEvent = triggerEvent.sourceEvent || triggerEvent.type;
  const chainDefs = CROSS_OBJECT_CHAINS[sourceEvent];
  const chainLog: Array<{ event: string; entityType: string; success: boolean }> = [];

  if (!chainDefs || chainDefs.length === 0) {
    return { executed: 0, chainLog };
  }

  let executed = 0;

  for (const chainStep of chainDefs) {
    // Fire the next event in the chain as a new workflow trigger
    const chainEvent: WorkflowTriggerEvent = {
      type: triggerEvent.type,
      entityType: chainStep.entityType,
      entityId: triggerEvent.entityId,
      data: { ...triggerEvent.data, chainSource: sourceEvent, chainEvent: chainStep.event },
      userId: triggerEvent.userId,
      sourceEvent: chainStep.event,
    };

    try {
      const count = await processWorkflowTrigger(chainEvent);
      chainLog.push({ event: chainStep.event, entityType: chainStep.entityType, success: count > 0 });
      executed += count;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[WorkflowEngine] Cross-object chain step failed', {
        sourceEvent,
        chainEvent: chainStep.event,
        error: msg,
      });
      chainLog.push({ event: chainStep.event, entityType: chainStep.entityType, success: false });
    }
  }

  logger.info('[WorkflowEngine] Cross-object chain completed', {
    sourceEvent,
    entityId: triggerEvent.entityId,
    executed,
    steps: chainLog.length,
  });

  return { executed, chainLog };
}

// ---------------------------------------------------------------------------
// Main execution engine
// ---------------------------------------------------------------------------

/**
 * Process a trigger event — find matching workflows and execute them.
 */
export async function processWorkflowTrigger(event: WorkflowTriggerEvent): Promise<number> {
  const workflows = await prisma.crmWorkflow.findMany({
    where: { status: 'ACTIVE', triggerType: event.type },
    include: { steps: { orderBy: { position: 'asc' } } },
  });

  let executedCount = 0;

  // Batch-fetch running executions for all matching workflows to avoid N+1
  const matchingWorkflowIds = workflows
    .filter(w => matchesTrigger(w, event))
    .map(w => w.id);

  const runningExecutions = matchingWorkflowIds.length > 0
    ? await prisma.crmWorkflowExecution.findMany({
        where: {
          workflowId: { in: matchingWorkflowIds },
          entityType: event.entityType,
          entityId: event.entityId,
          status: 'RUNNING',
        },
        select: { workflowId: true },
      })
    : [];
  const runningWorkflowIds = new Set(runningExecutions.map(e => e.workflowId));

  for (const workflow of workflows) {
    if (!matchesTrigger(workflow, event)) continue;

    // Check for duplicate execution (same entity, same workflow, still running)
    if (runningWorkflowIds.has(workflow.id)) continue;

    // Create execution record
    const execution = await prisma.crmWorkflowExecution.create({
      data: {
        workflowId: workflow.id,
        entityType: event.entityType,
        entityId: event.entityId,
        status: 'RUNNING',
      },
    });

    // Execute steps sequentially
    const executionLog: ExecutionLog[] = [];
    let failed = false;

    for (const step of workflow.steps) {
      // Handle WAIT action
      if (step.actionType === 'WAIT') {
        const waitMs = (step.delayMinutes || ((step.config as StepConfig)?.waitMinutes || 0)) * 60000;
        if (waitMs > 0) {
          // For now, skip wait (in production, use job queue with delayed execution)
          executionLog.push({
            stepPosition: step.position,
            actionType: step.actionType,
            status: 'success',
            message: `Wait ${waitMs / 60000} minutes (skipped in sync mode)`,
            timestamp: new Date().toISOString(),
          });
          continue;
        }
      }

      // I6: Handle PARALLEL action
      const stepConfig = (step.config as StepConfig) || {};
      if (step.actionType === 'WAIT' && stepConfig.branches) {
        // PARALLEL is encoded as a WAIT with branches config
      }
      if (stepConfig.branches && Array.isArray(stepConfig.branches)) {
        const parallelResult = await executeParallelPaths(
          execution.id,
          stepConfig.branches,
          event.entityType,
          event.entityId,
          event.userId
        );
        executionLog.push({
          stepPosition: step.position,
          actionType: 'PARALLEL',
          status: parallelResult.success ? 'success' : 'failed',
          message: `${stepConfig.branches.length} branches executed`,
          timestamp: new Date().toISOString(),
          branchLogs: parallelResult.branchLogs,
        });
        if (!parallelResult.success) {
          failed = true;
          break;
        }
        await prisma.crmWorkflowExecution.update({
          where: { id: execution.id },
          data: { currentStep: step.position },
        });
        continue;
      }

      // I7: Handle LOOP action
      if (stepConfig.collectionSource && stepConfig.loopBody) {
        const loopResult = await executeLoop(
          execution.id,
          {
            collectionSource: stepConfig.collectionSource,
            body: stepConfig.loopBody,
            maxIterations: stepConfig.maxIterations,
          },
          event.entityType,
          event.entityId,
          event.userId
        );
        executionLog.push({
          stepPosition: step.position,
          actionType: 'LOOP',
          status: loopResult.success ? 'success' : 'failed',
          message: `Loop over ${stepConfig.collectionSource}`,
          timestamp: new Date().toISOString(),
          iterationLogs: loopResult.iterationLogs,
        });
        if (!loopResult.success) {
          failed = true;
          break;
        }
        await prisma.crmWorkflowExecution.update({
          where: { id: execution.id },
          data: { currentStep: step.position },
        });
        continue;
      }

      // Check step condition
      if (step.conditionJson) {
        // Simple condition evaluation (can be extended)
        const condition = step.conditionJson as { field?: string; operator?: string; value?: unknown };
        if (condition.field) {
          // Skip condition evaluation for now — execute all steps
        }
      }

      // Handle delay before step
      if (step.delayMinutes > 0 && step.actionType !== 'WAIT') {
        // In production, schedule delayed execution via job queue
        // For now, log and continue
      }

      let result: { success: boolean; message?: string };
      try {
        result = await executeAction(step, event.entityType, event.entityId, event.userId);
      } catch (stepError) {
        const errorMsg = stepError instanceof Error ? stepError.message : String(stepError);
        logger.error('[WorkflowEngine] Step execution threw', {
          workflowId: workflow.id,
          executionId: execution.id,
          stepId: step.id,
          stepType: step.actionType,
          stepPosition: step.position,
          error: errorMsg,
        });
        result = { success: false, message: `Unhandled error: ${errorMsg}` };
      }

      // I8: Error handling — if step failed, apply error strategy
      if (!result.success && stepConfig.errorStrategy) {
        const errorResult = await handleStepError(
          execution.id,
          step.id,
          result.message || 'Step failed',
          step,
          event.entityType,
          event.entityId,
          event.userId
        );
        executionLog.push(...errorResult.logs);
        if (!errorResult.resolved) {
          failed = true;
          break;
        }
        // Error was resolved (retried, skipped, or fallback succeeded) — continue
        await prisma.crmWorkflowExecution.update({
          where: { id: execution.id },
          data: { currentStep: step.position },
        });
        continue;
      }

      executionLog.push({
        stepPosition: step.position,
        actionType: step.actionType,
        status: result.success ? 'success' : 'failed',
        message: result.message,
        timestamp: new Date().toISOString(),
      });

      if (!result.success) {
        logger.error('[WorkflowEngine] Step failed (no error strategy)', {
          workflowId: workflow.id,
          executionId: execution.id,
          stepId: step.id,
          stepType: step.actionType,
          stepPosition: step.position,
          error: result.message,
        });
        failed = true;
        break; // Stop workflow on first failure (no error strategy configured)
      }

      // Update current step
      await prisma.crmWorkflowExecution.update({
        where: { id: execution.id },
        data: { currentStep: step.position },
      });
    }

    // Mark execution complete
    await prisma.crmWorkflowExecution.update({
      where: { id: execution.id },
      data: {
        status: failed ? 'FAILED' : 'COMPLETED',
        completedAt: new Date(),
        log: executionLog as unknown as Prisma.InputJsonValue,
      },
    });

    executedCount++;
    logger.info('[WorkflowEngine] Workflow executed', {
      workflowId: workflow.id,
      workflowName: workflow.name,
      entityType: event.entityType,
      entityId: event.entityId,
      status: failed ? 'FAILED' : 'COMPLETED',
      steps: executionLog.length,
    });
  }

  return executedCount;
}

/**
 * Manually trigger a workflow for a specific entity.
 */
export async function triggerWorkflowManually(
  workflowId: string,
  entityType: 'lead' | 'deal',
  entityId: string,
  userId: string
): Promise<{ success: boolean; executionId?: string; error?: string }> {
  const workflow = await prisma.crmWorkflow.findUnique({
    where: { id: workflowId },
    include: { steps: { orderBy: { position: 'asc' } } },
  });

  if (!workflow) return { success: false, error: 'Workflow not found' };
  if (workflow.status !== 'ACTIVE') return { success: false, error: 'Workflow is not active' };

  const execution = await prisma.crmWorkflowExecution.create({
    data: {
      workflowId: workflow.id,
      entityType,
      entityId,
      status: 'RUNNING',
    },
  });

  const executionLog: ExecutionLog[] = [];
  let failed = false;

  for (const step of workflow.steps) {
    try {
      const result = await executeAction(step, entityType, entityId, userId);
      executionLog.push({
        stepPosition: step.position,
        actionType: step.actionType,
        status: result.success ? 'success' : 'failed',
        message: result.message,
        timestamp: new Date().toISOString(),
      });

      if (!result.success) {
        logger.error('[WorkflowEngine] Manual trigger step failed', {
          workflowId,
          executionId: execution.id,
          stepId: step.id,
          stepType: step.actionType,
          stepPosition: step.position,
          error: result.message,
        });
        failed = true;
        // Continue executing remaining steps instead of stopping the whole workflow
        continue;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('[WorkflowEngine] Manual trigger step execution threw', {
        workflowId,
        executionId: execution.id,
        stepId: step.id,
        stepType: step.actionType,
        stepPosition: step.position,
        error: errorMsg,
      });
      executionLog.push({
        stepPosition: step.position,
        actionType: step.actionType,
        status: 'failed',
        message: `Unhandled error: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      });
      failed = true;
      // Continue executing remaining steps instead of stopping the whole workflow
      continue;
    }
  }

  await prisma.crmWorkflowExecution.update({
    where: { id: execution.id },
    data: {
      status: failed ? 'FAILED' : 'COMPLETED',
      completedAt: new Date(),
      log: executionLog as unknown as Prisma.InputJsonValue,
    },
  });

  return { success: !failed, executionId: execution.id };
}

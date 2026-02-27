/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * Workflow Engine Service - Phase 3-7: Workflow Rules & Approvals
 *
 * Configurable workflow/approval system for accounting operations.
 * Evaluates rules in priority order (highest first), first match wins.
 *
 * Built-in rules:
 *   1. Expenses > $500: Require OWNER approval
 *   2. Journal entries > $10,000: Require OWNER approval
 *   3. Purchase orders > $5,000: Require OWNER approval
 *   4. Payroll runs: Always require OWNER approval
 *   5. Credit notes > $1,000: Require OWNER approval
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkflowEntityType =
  | 'JOURNAL_ENTRY'
  | 'EXPENSE'
  | 'PURCHASE_ORDER'
  | 'INVOICE'
  | 'CREDIT_NOTE'
  | 'PAYROLL_RUN'
  | 'TIME_ENTRY';

export type WorkflowTriggerEvent =
  | 'CREATE'
  | 'UPDATE'
  | 'STATUS_CHANGE'
  | 'AMOUNT_THRESHOLD';

export type WorkflowActionType =
  | 'REQUIRE_APPROVAL'
  | 'SEND_NOTIFICATION'
  | 'AUTO_APPROVE'
  | 'BLOCK';

export type ApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface WorkflowCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: string | number | boolean | string[];
}

export interface WorkflowAction {
  type: WorkflowActionType;
  params?: {
    role?: string;       // Role that can approve (OWNER, ADMIN)
    userId?: string;     // Specific user ID
    message?: string;    // Notification message
    expiresInDays?: number; // Days until approval expires
  };
}

export interface EntityContext {
  id: string;
  type: WorkflowEntityType;
  amount?: number;
  summary?: string;
  [key: string]: unknown;
}

export interface WorkflowEvaluationResult {
  ruleId: string | null;
  ruleName: string | null;
  requiresApproval: boolean;
  blocked: boolean;
  autoApproved: boolean;
  notifications: { message: string; role?: string; userId?: string }[];
  approvalRequestId?: string;
}

// ---------------------------------------------------------------------------
// Built-in default rules
// ---------------------------------------------------------------------------

interface DefaultRule {
  name: string;
  description: string;
  entityType: WorkflowEntityType;
  triggerEvent: WorkflowTriggerEvent;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  priority: number;
}

const DEFAULT_RULES: DefaultRule[] = [
  {
    name: 'Payroll runs require OWNER approval',
    description: 'All payroll runs must be approved by an OWNER before processing',
    entityType: 'PAYROLL_RUN',
    triggerEvent: 'CREATE',
    conditions: [], // Always matches for payroll
    actions: [{ type: 'REQUIRE_APPROVAL', params: { role: 'OWNER', expiresInDays: 7 } }],
    priority: 100,
  },
  {
    name: 'Journal entries > $10,000 require OWNER approval',
    description: 'Journal entries with total debits exceeding $10,000 need OWNER sign-off',
    entityType: 'JOURNAL_ENTRY',
    triggerEvent: 'AMOUNT_THRESHOLD',
    conditions: [{ field: 'amount', operator: 'gt', value: 10000 }],
    actions: [{ type: 'REQUIRE_APPROVAL', params: { role: 'OWNER', expiresInDays: 7 } }],
    priority: 90,
  },
  {
    name: 'Purchase orders > $5,000 require OWNER approval',
    description: 'Purchase orders exceeding $5,000 need OWNER sign-off',
    entityType: 'PURCHASE_ORDER',
    triggerEvent: 'AMOUNT_THRESHOLD',
    conditions: [{ field: 'amount', operator: 'gt', value: 5000 }],
    actions: [{ type: 'REQUIRE_APPROVAL', params: { role: 'OWNER', expiresInDays: 7 } }],
    priority: 80,
  },
  {
    name: 'Credit notes > $1,000 require OWNER approval',
    description: 'Credit notes exceeding $1,000 need OWNER sign-off',
    entityType: 'CREDIT_NOTE',
    triggerEvent: 'AMOUNT_THRESHOLD',
    conditions: [{ field: 'amount', operator: 'gt', value: 1000 }],
    actions: [{ type: 'REQUIRE_APPROVAL', params: { role: 'OWNER', expiresInDays: 7 } }],
    priority: 70,
  },
  {
    name: 'Expenses > $500 require OWNER approval',
    description: 'Expenses exceeding $500 need OWNER sign-off',
    entityType: 'EXPENSE',
    triggerEvent: 'AMOUNT_THRESHOLD',
    conditions: [{ field: 'amount', operator: 'gt', value: 500 }],
    actions: [{ type: 'REQUIRE_APPROVAL', params: { role: 'OWNER', expiresInDays: 7 } }],
    priority: 60,
  },
];

// ---------------------------------------------------------------------------
// Seed default rules
// ---------------------------------------------------------------------------

/**
 * Seed the built-in workflow rules into the database if they do not exist.
 * Idempotent: only inserts rules whose names are not already present.
 */
export async function seedDefaultWorkflowRules(): Promise<number> {
  let created = 0;
  for (const rule of DEFAULT_RULES) {
    const existing = await prisma.workflowRule.findFirst({
      where: { name: rule.name, deletedAt: null },
    });
    if (!existing) {
      await prisma.workflowRule.create({
        data: {
          name: rule.name,
          description: rule.description,
          entityType: rule.entityType,
          triggerEvent: rule.triggerEvent,
          conditions: JSON.stringify(rule.conditions),
          actions: JSON.stringify(rule.actions),
          priority: rule.priority,
          isActive: true,
          createdBy: 'system',
        },
      });
      created++;
    }
  }
  if (created > 0) {
    logger.info(`Seeded ${created} default workflow rules`);
  }
  return created;
}

// ---------------------------------------------------------------------------
// Condition evaluator
// ---------------------------------------------------------------------------

function evaluateCondition(condition: WorkflowCondition, entity: EntityContext): boolean {
  const fieldValue = entity[condition.field];

  // If field is undefined on the entity, condition does not match
  if (fieldValue === undefined || fieldValue === null) return false;

  const { operator, value } = condition;

  switch (operator) {
    case 'eq':
      return fieldValue === value;
    case 'ne':
      return fieldValue !== value;
    case 'gt':
      return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue > value;
    case 'gte':
      return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue >= value;
    case 'lt':
      return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue < value;
    case 'lte':
      return typeof fieldValue === 'number' && typeof value === 'number' && fieldValue <= value;
    case 'in':
      return Array.isArray(value) && value.includes(String(fieldValue));
    case 'contains':
      return typeof fieldValue === 'string' && typeof value === 'string' && fieldValue.includes(value);
    default:
      return false;
  }
}

function evaluateConditions(conditions: WorkflowCondition[], entity: EntityContext): boolean {
  // Empty conditions array = always matches (e.g., payroll runs)
  if (conditions.length === 0) return true;
  // All conditions must match (AND logic)
  return conditions.every((cond) => evaluateCondition(cond, entity));
}

// ---------------------------------------------------------------------------
// Email notification helper (lazy import to avoid top-level SDK init)
// ---------------------------------------------------------------------------

async function sendApprovalNotification(
  approvalId: string,
  entitySummary: string,
  amount: number | null,
  assignedRole?: string,
): Promise<void> {
  try {
    const { sendEmail } = await import('@/lib/email/email-service');

    // Find users with the assigned role (OWNER or EMPLOYEE) to notify
    const targetRole = assignedRole || 'OWNER';
    const approvers = await prisma.user.findMany({
      where: { role: targetRole },
      select: { email: true, name: true },
    });

    if (approvers.length === 0) {
      logger.warn('No approvers found for role', { role: targetRole });
      return;
    }

    const amountStr = amount != null ? `$${amount.toLocaleString('en-CA', { minimumFractionDigits: 2 })}` : 'N/A';
    const subject = `[Action Required] Approval needed: ${entitySummary}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e;">Approval Request</h2>
        <p>A new item requires your approval:</p>
        <div style="background: #f8f9fa; border-left: 4px solid #4f46e5; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 8px;"><strong>Item:</strong> ${entitySummary}</p>
          <p style="margin: 0 0 8px;"><strong>Amount:</strong> ${amountStr}</p>
          <p style="margin: 0;"><strong>Approval ID:</strong> ${approvalId}</p>
        </div>
        <p>Please log in to the admin panel to review and approve or reject this request.</p>
        <a href="${process.env.NEXTAUTH_URL || 'https://biocyclepeptides.com'}/admin/comptabilite/workflows"
           style="display: inline-block; background: #4f46e5; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; margin-top: 8px;">
          Review Approval
        </a>
      </div>
    `;

    for (const approver of approvers) {
      if (!approver.email) continue;
      await sendEmail({
        to: { email: approver.email, name: approver.name || undefined },
        subject,
        html,
        emailType: 'transactional',
      });
    }

    logger.info('Approval notification sent', { approvalId, recipients: approvers.length });
  } catch (error) {
    // Non-blocking: log and continue
    logger.error('Failed to send approval notification', {
      approvalId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ---------------------------------------------------------------------------
// Core workflow engine functions
// ---------------------------------------------------------------------------

/**
 * Evaluate active workflow rules for a given entity and event.
 * Rules are evaluated in priority order (highest first), first match wins.
 *
 * Returns the evaluation result including whether approval is required,
 * and creates an ApprovalRequest record if needed.
 */
export async function evaluateWorkflow(
  entityType: WorkflowEntityType,
  event: WorkflowTriggerEvent,
  entity: EntityContext,
  requestedBy?: string,
): Promise<WorkflowEvaluationResult> {
  const result: WorkflowEvaluationResult = {
    ruleId: null,
    ruleName: null,
    requiresApproval: false,
    blocked: false,
    autoApproved: false,
    notifications: [],
  };

  try {
    // Fetch active rules for this entity type, ordered by priority DESC
    const rules = await prisma.workflowRule.findMany({
      where: {
        entityType,
        isActive: true,
        deletedAt: null,
        OR: [
          { triggerEvent: event },
          { triggerEvent: 'AMOUNT_THRESHOLD' }, // Always evaluate threshold rules
        ],
      },
      orderBy: { priority: 'desc' },
    });

    if (rules.length === 0) return result;

    // Evaluate each rule; first match wins
    for (const rule of rules) {
      let conditions: WorkflowCondition[];
      try {
        conditions = JSON.parse(rule.conditions) as WorkflowCondition[];
      } catch {
        logger.warn('Invalid conditions JSON in workflow rule', { ruleId: rule.id });
        continue;
      }

      if (!evaluateConditions(conditions, entity)) continue;

      // Rule matched
      result.ruleId = rule.id;
      result.ruleName = rule.name;

      let actions: WorkflowAction[];
      try {
        actions = JSON.parse(rule.actions) as WorkflowAction[];
      } catch {
        logger.warn('Invalid actions JSON in workflow rule', { ruleId: rule.id });
        continue;
      }

      for (const action of actions) {
        switch (action.type) {
          case 'REQUIRE_APPROVAL': {
            result.requiresApproval = true;

            // Calculate expiry
            const expiresInDays = action.params?.expiresInDays ?? 7;
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + expiresInDays);

            // Create approval request
            const approval = await prisma.approvalRequest.create({
              data: {
                workflowRuleId: rule.id,
                entityType,
                entityId: entity.id,
                entitySummary: entity.summary || `${entityType} #${entity.id}`,
                amount: entity.amount != null ? new Prisma.Decimal(entity.amount) : null,
                status: 'PENDING',
                requestedBy: requestedBy || null,
                assignedRole: action.params?.role || 'OWNER',
                assignedTo: action.params?.userId || null,
                expiresAt,
              },
            });

            result.approvalRequestId = approval.id;

            // Send notification email (non-blocking)
            sendApprovalNotification(
              approval.id,
              entity.summary || `${entityType} #${entity.id}`,
              entity.amount ?? null,
              action.params?.role,
            ).catch(() => { /* already logged inside */ });

            break;
          }

          case 'SEND_NOTIFICATION': {
            result.notifications.push({
              message: action.params?.message || `Workflow rule triggered: ${rule.name}`,
              role: action.params?.role,
              userId: action.params?.userId,
            });
            break;
          }

          case 'AUTO_APPROVE': {
            result.autoApproved = true;
            break;
          }

          case 'BLOCK': {
            result.blocked = true;
            break;
          }
        }
      }

      // First match wins
      break;
    }
  } catch (error) {
    logger.error('Error evaluating workflow rules', {
      entityType,
      event,
      entityId: entity.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

/**
 * Check if an entity has a pending or approved approval request.
 * Also handles expiration: marks expired requests as EXPIRED on read.
 */
export async function checkApproval(
  entityType: string,
  entityId: string,
): Promise<{
  hasPending: boolean;
  isApproved: boolean;
  isRejected: boolean;
  latestRequest: {
    id: string;
    status: string;
    respondedBy: string | null;
    responseNote: string | null;
    respondedAt: Date | null;
  } | null;
}> {
  const requests = await prisma.approvalRequest.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
  });

  // Auto-expire any overdue PENDING requests
  const now = new Date();
  for (const req of requests) {
    if (req.status === 'PENDING' && req.expiresAt && req.expiresAt < now) {
      await prisma.approvalRequest.update({
        where: { id: req.id },
        data: { status: 'EXPIRED' },
      });
      req.status = 'EXPIRED';
    }
  }

  const latest = requests[0] || null;

  return {
    hasPending: requests.some((r) => r.status === 'PENDING'),
    isApproved: requests.some((r) => r.status === 'APPROVED'),
    isRejected: latest?.status === 'REJECTED',
    latestRequest: latest
      ? {
          id: latest.id,
          status: latest.status,
          respondedBy: latest.respondedBy,
          responseNote: latest.responseNote,
          respondedAt: latest.respondedAt,
        }
      : null,
  };
}

/**
 * Approve an approval request.
 */
export async function approveRequest(
  requestId: string,
  approvedBy: string,
  note?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const request = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return { success: false, error: 'Approval request not found' };
    }

    if (request.status !== 'PENDING') {
      return { success: false, error: `Cannot approve: current status is ${request.status}` };
    }

    // Check expiry
    if (request.expiresAt && request.expiresAt < new Date()) {
      await prisma.approvalRequest.update({
        where: { id: requestId },
        data: { status: 'EXPIRED' },
      });
      return { success: false, error: 'Approval request has expired' };
    }

    await prisma.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        respondedBy: approvedBy,
        respondedAt: new Date(),
        responseNote: note || null,
      },
    });

    logger.info('Approval request approved', {
      requestId,
      approvedBy,
      entityType: request.entityType,
      entityId: request.entityId,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error approving request', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Reject an approval request.
 */
export async function rejectRequest(
  requestId: string,
  rejectedBy: string,
  note: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const request = await prisma.approvalRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return { success: false, error: 'Approval request not found' };
    }

    if (request.status !== 'PENDING') {
      return { success: false, error: `Cannot reject: current status is ${request.status}` };
    }

    await prisma.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        respondedBy: rejectedBy,
        respondedAt: new Date(),
        responseNote: note,
      },
    });

    logger.info('Approval request rejected', {
      requestId,
      rejectedBy,
      entityType: request.entityType,
      entityId: request.entityId,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error rejecting request', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: 'Internal error' };
  }
}

/**
 * Get pending approvals assigned to a specific user or role.
 * Handles auto-expiration of overdue requests.
 */
export async function getMyApprovals(
  userId: string,
  userRole?: string,
): Promise<{
  id: string;
  workflowRuleId: string | null;
  entityType: string;
  entityId: string;
  entitySummary: string | null;
  amount: number | null;
  status: string;
  requestedBy: string | null;
  requestedAt: Date;
  assignedTo: string | null;
  assignedRole: string | null;
  expiresAt: Date | null;
}[]> {
  const where: Prisma.ApprovalRequestWhereInput = {
    status: 'PENDING',
    OR: [
      { assignedTo: userId },
      ...(userRole ? [{ assignedRole: userRole }] : []),
    ],
  };

  const requests = await prisma.approvalRequest.findMany({
    where,
    orderBy: { requestedAt: 'desc' },
  });

  // Auto-expire overdue requests
  const now = new Date();
  const active: typeof requests = [];
  for (const req of requests) {
    if (req.expiresAt && req.expiresAt < now) {
      await prisma.approvalRequest.update({
        where: { id: req.id },
        data: { status: 'EXPIRED' },
      });
    } else {
      active.push(req);
    }
  }

  return active.map((r) => ({
    id: r.id,
    workflowRuleId: r.workflowRuleId,
    entityType: r.entityType,
    entityId: r.entityId,
    entitySummary: r.entitySummary,
    amount: r.amount ? Number(r.amount) : null,
    status: r.status,
    requestedBy: r.requestedBy,
    requestedAt: r.requestedAt,
    assignedTo: r.assignedTo,
    assignedRole: r.assignedRole,
    expiresAt: r.expiresAt,
  }));
}

/**
 * Get count of pending approvals for a user/role.
 */
export async function getPendingCount(
  userId: string,
  userRole?: string,
): Promise<number> {
  const now = new Date();
  const where: Prisma.ApprovalRequestWhereInput = {
    status: 'PENDING',
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: now } },
    ],
    AND: {
      OR: [
        { assignedTo: userId },
        ...(userRole ? [{ assignedRole: userRole }] : []),
      ],
    },
  };

  return prisma.approvalRequest.count({ where });
}

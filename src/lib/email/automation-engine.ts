/**
 * Workflow Automation Engine - BioCycle Peptides
 *
 * Executes email automation flows stored in EmailAutomationFlow.
 * Flows are designed as directed graphs (React Flow) with typed nodes
 * (trigger, email, delay, condition, sms, push) connected by edges.
 *
 * Usage:
 *   import { handleEvent } from '@/lib/email/automation-engine';
 *   await handleEvent('order.created', { email: 'user@example.com', name: 'Alice', orderId: '...' });
 */

import { prisma } from '@/lib/db';
import { escapeHtml } from '@/lib/email/templates/base-template';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single node in the React Flow graph */
export interface FlowNode {
  id: string;
  type: 'trigger' | 'email' | 'sms' | 'delay' | 'condition' | 'push';
  position: { x: number; y: number };
  data: {
    label: string;
    // Trigger
    triggerEvent?: string;
    // Email
    templateId?: string;
    subject?: string;
    htmlContent?: string;
    // Delay
    delayAmount?: number;
    delayUnit?: 'minutes' | 'hours' | 'days' | 'weeks';
    // Condition
    conditionField?: string;
    conditionOperator?: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
    conditionValue?: string;
    // SMS
    smsMessage?: string;
    // Push
    pushTitle?: string;
    pushBody?: string;
  };
}

/** A directed edge connecting two nodes */
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string; // 'true' | 'false' for condition branches
  label?: string;
}

/** Typed context passed through flow nodes during execution */
export interface FlowContext {
  email: string;
  name?: string;
  userId?: string;
  orderId?: string;
  orderTotal?: number;
  locale?: string;
  _flowId?: string;
  [key: string]: unknown; // Allow extra fields
}

/** Runtime statistics persisted alongside each flow */
export interface FlowStats {
  triggered: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  revenue: number;
}

/** All trigger events the engine can react to */
export type TriggerEvent =
  | 'order.created'
  | 'order.shipped'
  | 'order.delivered'
  | 'cart.abandoned'
  | 'user.registered'
  | 'user.birthday'
  | 'subscription.renewed'
  | 'review.received'
  | 'stock.low'
  | 'stock.back'
  | 'points.expiring'
  | 'referral.completed'
  | 'winback.eligible'
  | 'reorder.due'
  | 'browse.abandoned'
  | 'loyalty.tier_up'
  | 'sunset.eligible';

// ---------------------------------------------------------------------------
// Active flows cache (avoids DB round-trip on every event)
// ---------------------------------------------------------------------------

let activeFlowsCache: { flows: { id: string; trigger: string; nodes: string; edges: string }[]; cachedAt: number } | null = null;
const FLOW_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getActiveFlows(trigger: string) {
  if (activeFlowsCache && Date.now() - activeFlowsCache.cachedAt < FLOW_CACHE_TTL_MS) {
    return activeFlowsCache.flows.filter(f => f.trigger === trigger);
  }
  const flows = await prisma.emailAutomationFlow.findMany({
    where: { isActive: true },
  });
  activeFlowsCache = { flows, cachedAt: Date.now() };
  return flows.filter(f => f.trigger === trigger);
}

/** Clear the active flows cache (call when flows are created, updated, or deleted) */
export function clearFlowCache(): void {
  activeFlowsCache = null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Handle an event by finding and executing every active flow whose trigger
 * matches the given event name.
 *
 * @param event   The trigger event (e.g. 'order.created')
 * @param context Arbitrary key/value pairs forwarded to every node in the
 *                flow. Must contain at least `email` for email nodes to work.
 */
export async function handleEvent(
  event: TriggerEvent,
  context: FlowContext,
): Promise<void> {
  const flows = await getActiveFlows(event);

  for (const flow of flows) {
    try {
      const nodes: FlowNode[] = JSON.parse(flow.nodes);
      const edges: FlowEdge[] = JSON.parse(flow.edges);

      // Locate the trigger entry-point
      const triggerNode = nodes.find((n) => n.type === 'trigger');
      if (!triggerNode) continue;

      // Walk the graph starting from the trigger (inject flowId for delay scheduling)
      await executeFlowFromNode(flow.id, triggerNode.id, nodes, edges, { ...context, _flowId: flow.id });

      // Atomically increment the "triggered" counter to avoid race conditions
      await incrementFlowStat(flow.id, 'triggered');
    } catch (error) {
      logger.error(`[automation] Error executing flow ${flow.id}`, { error });
    }
  }
}

// ---------------------------------------------------------------------------
// Graph traversal
// ---------------------------------------------------------------------------

/**
 * Recursively walk the flow graph starting from `nodeId`.
 * For condition nodes the boolean result decides which outgoing edges to
 * follow (edges whose `sourceHandle` matches `"true"` or `"false"`).
 */
const FLOW_MAX_NODES = 50; // Max nodes to process per execution (prevents runaway flows)
const FLOW_EXECUTION_TIMEOUT_MS = 30000; // 30s max execution time per flow

async function executeFlowFromNode(
  flowId: string,
  nodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  context: FlowContext,
  visited: Set<string> = new Set(),
  executionStart: number = Date.now(),
): Promise<void> {
  // Timeout guard: prevent flows from running too long
  if (Date.now() - executionStart > FLOW_EXECUTION_TIMEOUT_MS) {
    logger.error('[automation] Flow execution timeout', { flowId });
    return;
  }
  // Cycle detection + execution budget: prevent infinite recursion and runaway flows
  if (visited.has(nodeId)) return;
  if (visited.size >= FLOW_MAX_NODES) {
    logger.warn(`[automation] Flow ${flowId}: max node limit (${FLOW_MAX_NODES}) reached, stopping`);
    return;
  }
  visited.add(nodeId);

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return;

  const result = await executeNode(node, context);

  // Delay nodes schedule via DB and halt graph traversal — cron picks up later
  if (node.type === 'delay') return;

  // Determine which edges to follow
  let nextEdges = edges.filter((e) => e.source === nodeId);

  if (node.type === 'condition') {
    // Only follow the branch matching the boolean result
    nextEdges = nextEdges.filter((e) => e.sourceHandle === String(result));
  }

  for (const edge of nextEdges) {
    await executeFlowFromNode(flowId, edge.target, nodes, edges, context, visited, executionStart);
  }
}

// ---------------------------------------------------------------------------
// Node validation
// ---------------------------------------------------------------------------

/**
 * Validate that a flow node has all required fields for its type.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateNode(node: FlowNode): string | null {
  switch (node.type) {
    case 'trigger':
      if (!node.data.triggerEvent) {
        return `Trigger node "${node.id}" is missing required field: eventType (triggerEvent)`;
      }
      return null;

    case 'email':
    case 'send_email' as FlowNode['type']:
      if (!node.data.templateId && !node.data.subject) {
        return `Email node "${node.id}" requires either templateId or subject`;
      }
      return null;

    case 'delay':
      if (!node.data.delayAmount || node.data.delayAmount <= 0) {
        return `Delay node "${node.id}" requires delayAmount > 0`;
      }
      if (!node.data.delayUnit || !['minutes', 'hours', 'days', 'weeks'].includes(node.data.delayUnit)) {
        return `Delay node "${node.id}" requires a valid delayUnit (minutes, hours, days, weeks)`;
      }
      return null;

    case 'condition':
      if (!node.data.conditionField) {
        return `Condition node "${node.id}" requires a field (conditionField)`;
      }
      if (!node.data.conditionOperator) {
        return `Condition node "${node.id}" requires an operator (conditionOperator)`;
      }
      return null;

    case 'sms':
      if (!node.data.smsMessage) {
        return `SMS node "${node.id}" requires smsMessage`;
      }
      return null;

    case 'push':
      if (!node.data.pushTitle) {
        return `Push node "${node.id}" requires pushTitle`;
      }
      return null;

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Node executors
// ---------------------------------------------------------------------------

/**
 * Execute a single node and return a boolean indicating the result.
 * For condition nodes the boolean drives the branching logic.
 * For all other node types `true` means "success / continue".
 */
async function executeNode(
  node: FlowNode,
  context: FlowContext,
): Promise<boolean> {
  // Validate node before execution
  const validationError = validateNode(node);
  if (validationError) {
    logger.warn(`[automation] Skipping invalid node: ${validationError}`);
    return true; // Skip and continue to next nodes
  }

  switch (node.type) {
    // -- Trigger (already matched) ----------------------------------------
    case 'trigger':
      return true;

    // -- Email ------------------------------------------------------------
    case 'email': {
      const email = context.email as string | undefined;
      if (!email || !node.data.subject) return true;

      // Check bounce suppression before sending
      const { shouldSuppressEmail } = await import('@/lib/email/bounce-handler');
      const { suppressed } = await shouldSuppressEmail(email);
      if (suppressed) return true;

      // Transactional emails (order confirmations, shipping, refunds) are always
      // sent regardless of marketing consent — they are legally required / expected.
      const isTransactional = node.data.templateId &&
        /^(order:|shipping:|refund:)/.test(node.data.templateId);

      // RGPD compliance: verify active consent before sending marketing emails
      if (!isTransactional) {
        const activeConsent = await prisma.consentRecord.findFirst({
          where: {
            email: email.toLowerCase(),
            type: { in: ['marketing', 'newsletter'] },
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: { id: true },
        });
        if (!activeConsent) return true;
      }

      const { sendEmail } = await import('@/lib/email/email-service');
      const { generateUnsubscribeUrl } = await import('@/lib/email/unsubscribe');

      const html = replaceVariables(node.data.htmlContent || '', context, true);
      const subject = replaceVariables(node.data.subject, context, false);

      // Generate unsubscribe URL (CAN-SPAM / RGPD / LCAP compliance)
      const unsubscribeUrl = await generateUnsubscribeUrl(
        email,
        'marketing',
        (context.userId as string) || undefined,
      ).catch((unsErr) => {
        logger.warn('[automation] Failed to generate unsubscribe URL (non-blocking):', { email, error: unsErr instanceof Error ? unsErr.message : String(unsErr) });
        return undefined;
      });

      const result = await sendEmail({
        to: { email, name: (context.name as string) || undefined },
        subject,
        html,
        unsubscribeUrl,
      });

      // Increment 'sent' stat on successful send
      if (result.success && context._flowId) {
        await incrementFlowStat(context._flowId as string, 'sent').catch((statErr) => {
          logger.warn('[automation] Failed to increment sent stat (non-blocking):', { flowId: context._flowId, error: statErr instanceof Error ? statErr.message : String(statErr) });
        });
      }
      return true;
    }

    // -- Delay ------------------------------------------------------------
    case 'delay': {
      // Schedule delayed execution via EmailFlowExecution table.
      // The /api/cron/email-flows endpoint processes these when executeAt arrives.
      const delayMs = getDelayMs(node.data.delayAmount, node.data.delayUnit);
      const email = context.email as string;
      if (email && context._flowId) {
        // Faille MEDIUM: limit serialized context size to 10 KB
        const MAX_CONTEXT_SIZE = 10240;
        let serializedContext = JSON.stringify(context);
        if (serializedContext.length > MAX_CONTEXT_SIZE) {
          logger.warn(
            `[automation] Context too large (${serializedContext.length} bytes) for flow ${context._flowId}, trimming non-essential fields`,
          );
          // Keep only essential fields, drop anything else
          const essentialKeys = ['email', 'name', 'userId', 'orderId', '_flowId'] as const;
          const trimmedContext: Partial<FlowContext> = {};
          for (const key of essentialKeys) {
            if (key in context) trimmedContext[key] = context[key];
          }
          serializedContext = JSON.stringify(trimmedContext);
        }

        await prisma.emailFlowExecution.create({
          data: {
            flowId: context._flowId as string,
            email,
            currentNode: node.id,
            context: serializedContext,
            status: 'WAITING',
            executeAt: new Date(Date.now() + delayMs),
          },
        });
      }
      // Return false to stop recursive execution — the cron will pick it up
      return false;
    }

    // -- Condition --------------------------------------------------------
    case 'condition': {
      const fieldValue = String(context[node.data.conditionField || ''] ?? '');
      const compareValue = node.data.conditionValue || '';

      switch (node.data.conditionOperator) {
        case 'equals':
          return fieldValue === compareValue;
        case 'not_equals':
          return fieldValue !== compareValue;
        case 'greater_than':
          return Number(fieldValue) > Number(compareValue);
        case 'less_than':
          return Number(fieldValue) < Number(compareValue);
        case 'contains':
          return fieldValue.toLowerCase().includes(compareValue.toLowerCase());
        default:
          return false;
      }
    }

    // -- SMS (placeholder) ------------------------------------------------
    case 'sms': {
      logger.info(
        `[automation] SMS to ${context.phone ?? 'unknown'}: ${node.data.smsMessage}`,
      );
      // TODO: Integrate Twilio or another SMS provider
      return true;
    }

    // -- Push notification (placeholder) ----------------------------------
    case 'push': {
      logger.info(
        `[automation] Push: ${node.data.pushTitle} - ${node.data.pushBody}`,
      );
      // TODO: Integrate Web Push / Firebase Cloud Messaging
      return true;
    }

    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert delay amount + unit to milliseconds
 */
function getDelayMs(amount?: number, unit?: string): number {
  const a = Math.max(1, amount || 1);
  switch (unit) {
    case 'minutes': return a * 60 * 1000;
    case 'hours': return a * 60 * 60 * 1000;
    case 'days': return a * 24 * 60 * 60 * 1000;
    case 'weeks': return a * 7 * 24 * 60 * 60 * 1000;
    default: return a * 60 * 60 * 1000;
  }
}

/**
 * Atomically increment a stat counter on an EmailAutomationFlow.
 * Uses raw SQL to avoid read-modify-write race conditions.
 */
export async function incrementFlowStat(
  flowId: string,
  stat: keyof FlowStats,
  amount: number = 1,
): Promise<void> {
  try {
    // PostgreSQL JSON atomic update: increment a single key within the stats JSON
    await prisma.$executeRaw`
      UPDATE "EmailAutomationFlow"
      SET stats = jsonb_set(
        COALESCE(stats::jsonb, '{"triggered":0,"sent":0,"delivered":0,"opened":0,"clicked":0,"bounced":0,"revenue":0}'::jsonb),
        ${`{${stat}}`}::text[],
        (COALESCE((stats::jsonb->>${stat})::int, 0) + ${amount})::text::jsonb
      )
      WHERE id = ${flowId}
    `;
  } catch (err) {
    logger.error(`[automation] Failed to increment stat ${stat} for flow ${flowId}`, { error: err });
  }
}

/**
 * Replace `{{variable}}` placeholders in a template string with values
 * from the context map. Supports nested dot-notation keys up to 2 levels deep.
 * Unresolved placeholders are left as-is.
 *
 * Security (#27): Uses hasOwnProperty checks to prevent prototype pollution
 * (e.g. {{constructor.prototype}} or {{__proto__}}) and limits nesting depth to 2.
 *
 * @param htmlContext If true, values are HTML-escaped to prevent XSS.
 *                   Use false for plain-text contexts like email subjects.
 */
const MAX_VARIABLE_DEPTH = 2;
/** Maximum output size after variable replacement (1 MB) */
export const MAX_REPLACEMENT_OUTPUT_SIZE = 1_048_576;

/** Pre-compiled regex for {{variable}} replacement (avoids re-creation on every call) */
const VARIABLE_PATTERN = /\{\{(\w+(?:\.\w+)?)\}\}/g;

function replaceVariables(
  template: string,
  context: FlowContext,
  htmlContext: boolean = true,
): string {
  const result = template.replace(VARIABLE_PATTERN, (match, key: string) => {
    const parts = key.split('.');
    // #27 Security fix: limit depth to prevent deep property traversal
    if (parts.length > MAX_VARIABLE_DEPTH) return match;
    let value: unknown = context;
    for (const part of parts) {
      if (value === null || value === undefined) break;
      // #27 Security fix: hasOwnProperty check to prevent prototype pollution
      // Blocks access to __proto__, constructor, prototype, etc.
      if (typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, part)) {
        value = undefined;
        break;
      }
      value = (value as Record<string, unknown>)[part];
    }
    if (value === undefined || value === null) return match;
    const strValue = String(value);
    return htmlContext ? escapeHtml(strValue) : strValue;
  });

  // Faille MEDIUM: guard against excessively large output after replacement
  if (result.length > MAX_REPLACEMENT_OUTPUT_SIZE) {
    logger.warn(
      `[automation] Variable replacement output too large (${result.length} chars), truncating to ${MAX_REPLACEMENT_OUTPUT_SIZE}`,
    );
    return result.slice(0, MAX_REPLACEMENT_OUTPUT_SIZE);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Pre-built flow templates
// ---------------------------------------------------------------------------

export interface PreBuiltFlow {
  name: string;
  description: string;
  trigger: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/**
 * Returns a collection of ready-to-use automation flows that can be imported
 * into the visual editor. Each flow is a complete graph with trigger, delays,
 * conditions, and email steps pre-configured.
 */
export function getPreBuiltFlows(): PreBuiltFlow[] {
  return [
    // -- 1. Welcome series ------------------------------------------------
    {
      name: "Serie d'accueil",
      description: 'Bienvenue + Education + Best-sellers + Code promo sur 7 jours',
      trigger: 'user.registered',
      nodes: [
        {
          id: '1',
          type: 'trigger',
          position: { x: 250, y: 0 },
          data: { label: 'Inscription', triggerEvent: 'user.registered' },
        },
        {
          id: '2',
          type: 'email',
          position: { x: 250, y: 100 },
          data: {
            label: 'Email Bienvenue',
            subject: 'Bienvenue chez BioCycle Peptides!',
            htmlContent: '',
          },
        },
        {
          id: '3',
          type: 'delay',
          position: { x: 250, y: 200 },
          data: { label: 'Attendre 2 jours', delayAmount: 2, delayUnit: 'days' },
        },
        {
          id: '4',
          type: 'email',
          position: { x: 250, y: 300 },
          data: {
            label: 'Education Peptides',
            subject: 'Decouvrez nos peptides de recherche',
            htmlContent: '',
          },
        },
        {
          id: '5',
          type: 'delay',
          position: { x: 250, y: 400 },
          data: { label: 'Attendre 2 jours', delayAmount: 2, delayUnit: 'days' },
        },
        {
          id: '6',
          type: 'email',
          position: { x: 250, y: 500 },
          data: {
            label: 'Best-Sellers',
            subject: 'Nos peptides les plus populaires',
            htmlContent: '',
          },
        },
        {
          id: '7',
          type: 'delay',
          position: { x: 250, y: 600 },
          data: { label: 'Attendre 3 jours', delayAmount: 3, delayUnit: 'days' },
        },
        {
          id: '8',
          type: 'email',
          position: { x: 250, y: 700 },
          data: {
            label: 'Code Promo',
            subject: 'Un cadeau pour votre premiere commande!',
            htmlContent: '',
          },
        },
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' },
        { id: 'e3-4', source: '3', target: '4' },
        { id: 'e4-5', source: '4', target: '5' },
        { id: 'e5-6', source: '5', target: '6' },
        { id: 'e6-7', source: '6', target: '7' },
        { id: 'e7-8', source: '7', target: '8' },
      ],
    },

    // -- 2. Abandoned cart ------------------------------------------------
    {
      name: 'Panier abandonne',
      description: 'Rappel 30min + Preuve sociale 24h + Incentive 72h',
      trigger: 'cart.abandoned',
      nodes: [
        {
          id: '1',
          type: 'trigger',
          position: { x: 250, y: 0 },
          data: { label: 'Panier abandonne', triggerEvent: 'cart.abandoned' },
        },
        {
          id: '2',
          type: 'delay',
          position: { x: 250, y: 100 },
          data: { label: 'Attendre 30 min', delayAmount: 30, delayUnit: 'minutes' },
        },
        {
          id: '3',
          type: 'email',
          position: { x: 250, y: 200 },
          data: {
            label: 'Rappel Panier',
            subject: 'Vous avez oublie quelque chose!',
            htmlContent: '',
          },
        },
        {
          id: '4',
          type: 'delay',
          position: { x: 250, y: 300 },
          data: { label: 'Attendre 24h', delayAmount: 24, delayUnit: 'hours' },
        },
        {
          id: '5',
          type: 'condition',
          position: { x: 250, y: 400 },
          data: {
            label: 'A achete?',
            conditionField: 'hasOrdered',
            conditionOperator: 'equals',
            conditionValue: 'false',
          },
        },
        {
          id: '6',
          type: 'email',
          position: { x: 250, y: 500 },
          data: {
            label: 'Preuve sociale',
            subject: 'Nos clients adorent ces produits',
            htmlContent: '',
          },
        },
        {
          id: '7',
          type: 'delay',
          position: { x: 250, y: 600 },
          data: { label: 'Attendre 48h', delayAmount: 48, delayUnit: 'hours' },
        },
        {
          id: '8',
          type: 'condition',
          position: { x: 250, y: 700 },
          data: {
            label: 'A achete?',
            conditionField: 'hasOrdered',
            conditionOperator: 'equals',
            conditionValue: 'false',
          },
        },
        {
          id: '9',
          type: 'email',
          position: { x: 250, y: 800 },
          data: {
            label: 'Offre temps-limite',
            subject: '-10% sur votre panier - expire dans 24h!',
            htmlContent: '',
          },
        },
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' },
        { id: 'e3-4', source: '3', target: '4' },
        { id: 'e4-5', source: '4', target: '5' },
        { id: 'e5-6', source: '5', target: '6', sourceHandle: 'true' },
        { id: 'e6-7', source: '6', target: '7' },
        { id: 'e7-8', source: '7', target: '8' },
        { id: 'e8-9', source: '8', target: '9', sourceHandle: 'true' },
      ],
    },

    // -- 3. Post-purchase -------------------------------------------------
    {
      name: 'Post-achat',
      description: 'Merci J2 + Review J7 + Cross-sell J14 + Reapprovisionnement J30',
      trigger: 'order.delivered',
      nodes: [
        {
          id: '1',
          type: 'trigger',
          position: { x: 250, y: 0 },
          data: { label: 'Commande livree', triggerEvent: 'order.delivered' },
        },
        {
          id: '2',
          type: 'delay',
          position: { x: 250, y: 100 },
          data: { label: 'Attendre 2 jours', delayAmount: 2, delayUnit: 'days' },
        },
        {
          id: '3',
          type: 'email',
          position: { x: 250, y: 200 },
          data: {
            label: 'Merci + Instructions',
            subject: 'Merci pour votre commande - Instructions',
            htmlContent: '',
          },
        },
        {
          id: '4',
          type: 'delay',
          position: { x: 250, y: 300 },
          data: { label: 'Attendre 5 jours', delayAmount: 5, delayUnit: 'days' },
        },
        {
          id: '5',
          type: 'email',
          position: { x: 250, y: 400 },
          data: {
            label: 'Demande Review',
            subject: 'Comment etait votre experience?',
            htmlContent: '',
          },
        },
        {
          id: '6',
          type: 'delay',
          position: { x: 250, y: 500 },
          data: { label: 'Attendre 7 jours', delayAmount: 7, delayUnit: 'days' },
        },
        {
          id: '7',
          type: 'email',
          position: { x: 250, y: 600 },
          data: {
            label: 'Cross-sell',
            subject: 'Completez votre protocole de recherche',
            htmlContent: '',
          },
        },
        {
          id: '8',
          type: 'delay',
          position: { x: 250, y: 700 },
          data: { label: 'Attendre 16 jours', delayAmount: 16, delayUnit: 'days' },
        },
        {
          id: '9',
          type: 'email',
          position: { x: 250, y: 800 },
          data: {
            label: 'Reapprovisionnement',
            subject: 'Temps de recommander?',
            htmlContent: '',
          },
        },
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' },
        { id: 'e3-4', source: '3', target: '4' },
        { id: 'e4-5', source: '4', target: '5' },
        { id: 'e5-6', source: '5', target: '6' },
        { id: 'e6-7', source: '6', target: '7' },
        { id: 'e7-8', source: '7', target: '8' },
        { id: 'e8-9', source: '8', target: '9' },
      ],
    },

    // -- 4. Win-back ------------------------------------------------------
    {
      name: 'Win-back (Reconquete)',
      description: 'Vous manquez J60 + Nouveautes J75 + Remise J90 + Sunset J120',
      trigger: 'winback.eligible',
      nodes: [
        {
          id: '1',
          type: 'trigger',
          position: { x: 250, y: 0 },
          data: { label: 'Client inactif 60j', triggerEvent: 'winback.eligible' },
        },
        {
          id: '2',
          type: 'email',
          position: { x: 250, y: 100 },
          data: {
            label: 'Vous nous manquez',
            subject: 'Vous nous manquez!',
            htmlContent: '',
          },
        },
        {
          id: '3',
          type: 'delay',
          position: { x: 250, y: 200 },
          data: { label: 'Attendre 15 jours', delayAmount: 15, delayUnit: 'days' },
        },
        {
          id: '4',
          type: 'condition',
          position: { x: 250, y: 300 },
          data: {
            label: 'A revisite?',
            conditionField: 'hasVisited',
            conditionOperator: 'equals',
            conditionValue: 'false',
          },
        },
        {
          id: '5',
          type: 'email',
          position: { x: 250, y: 400 },
          data: {
            label: 'Nouveautes',
            subject: 'Decouvrez nos nouveaux produits',
            htmlContent: '',
          },
        },
        {
          id: '6',
          type: 'delay',
          position: { x: 250, y: 500 },
          data: { label: 'Attendre 15 jours', delayAmount: 15, delayUnit: 'days' },
        },
        {
          id: '7',
          type: 'email',
          position: { x: 250, y: 600 },
          data: {
            label: 'Remise exclusive',
            subject: '-15% exclusif - Revenez nous voir!',
            htmlContent: '',
          },
        },
        {
          id: '8',
          type: 'delay',
          position: { x: 250, y: 700 },
          data: { label: 'Attendre 30 jours', delayAmount: 30, delayUnit: 'days' },
        },
        {
          id: '9',
          type: 'email',
          position: { x: 250, y: 800 },
          data: {
            label: 'Sunset',
            subject: 'On se dit au revoir?',
            htmlContent: '',
          },
        },
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' },
        { id: 'e3-4', source: '3', target: '4' },
        { id: 'e4-5', source: '4', target: '5', sourceHandle: 'true' },
        { id: 'e5-6', source: '5', target: '6' },
        { id: 'e6-7', source: '6', target: '7' },
        { id: 'e7-8', source: '7', target: '8' },
        { id: 'e8-9', source: '8', target: '9' },
      ],
    },

    // -- 5. Browse Abandonment -----------------------------------------------
    {
      name: 'Abandon de navigation',
      description: 'Interet 4h + Similaires 24h + Incentive 48h (si panier > 100$)',
      trigger: 'browse.abandoned',
      nodes: [
        {
          id: '1',
          type: 'trigger',
          position: { x: 250, y: 0 },
          data: { label: 'Navigation abandonnee', triggerEvent: 'browse.abandoned' },
        },
        {
          id: '2',
          type: 'delay',
          position: { x: 250, y: 100 },
          data: { label: 'Attendre 4h', delayAmount: 4, delayUnit: 'hours' },
        },
        {
          id: '3',
          type: 'email',
          position: { x: 250, y: 200 },
          data: {
            label: 'Toujours interesse?',
            subject: 'Toujours interesse(e) par {{productName}}?',
            htmlContent: '',
          },
        },
        {
          id: '4',
          type: 'delay',
          position: { x: 250, y: 300 },
          data: { label: 'Attendre 24h', delayAmount: 24, delayUnit: 'hours' },
        },
        {
          id: '5',
          type: 'condition',
          position: { x: 250, y: 400 },
          data: {
            label: 'Ajoute au panier?',
            conditionField: 'addedToCart',
            conditionOperator: 'equals',
            conditionValue: 'false',
          },
        },
        {
          id: '6',
          type: 'email',
          position: { x: 250, y: 500 },
          data: {
            label: 'Produits similaires',
            subject: 'Des produits similaires qui pourraient vous plaire',
            htmlContent: '',
          },
        },
        {
          id: '7',
          type: 'delay',
          position: { x: 250, y: 600 },
          data: { label: 'Attendre 48h', delayAmount: 48, delayUnit: 'hours' },
        },
        {
          id: '8',
          type: 'condition',
          position: { x: 250, y: 700 },
          data: {
            label: 'Panier > 100$?',
            conditionField: 'cartValue',
            conditionOperator: 'greater_than',
            conditionValue: '100',
          },
        },
        {
          id: '9',
          type: 'email',
          position: { x: 250, y: 800 },
          data: {
            label: 'Incentive 5%',
            subject: '5% de rabais - offre limitee!',
            htmlContent: '',
          },
        },
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' },
        { id: 'e3-4', source: '3', target: '4' },
        { id: 'e4-5', source: '4', target: '5' },
        { id: 'e5-6', source: '5', target: '6', sourceHandle: 'true' },
        { id: 'e6-7', source: '6', target: '7' },
        { id: 'e7-8', source: '7', target: '8' },
        { id: 'e8-9', source: '8', target: '9', sourceHandle: 'true' },
      ],
    },

    // -- 6. Replenishment Reminder -------------------------------------------
    {
      name: 'Rappel de reapprovisionnement',
      description: 'Rappel J25 + Urgence J30 + Incentive J35 (critique pour peptides)',
      trigger: 'reorder.due',
      nodes: [
        {
          id: '1',
          type: 'trigger',
          position: { x: 250, y: 0 },
          data: { label: 'Reapprovisionnement du', triggerEvent: 'reorder.due' },
        },
        {
          id: '2',
          type: 'email',
          position: { x: 250, y: 100 },
          data: {
            label: 'Rappel reappro',
            subject: 'Bientot a court de {{productName}}? Recommandez maintenant',
            htmlContent: '',
          },
        },
        {
          id: '3',
          type: 'delay',
          position: { x: 250, y: 200 },
          data: { label: 'Attendre 5 jours', delayAmount: 5, delayUnit: 'days' },
        },
        {
          id: '4',
          type: 'condition',
          position: { x: 250, y: 300 },
          data: {
            label: 'A recommande?',
            conditionField: 'hasReordered',
            conditionOperator: 'equals',
            conditionValue: 'false',
          },
        },
        {
          id: '5',
          type: 'email',
          position: { x: 250, y: 400 },
          data: {
            label: 'Urgence',
            subject: 'Ne tombez pas en rupture! Derniere chance de recommander',
            htmlContent: '',
          },
        },
        {
          id: '6',
          type: 'delay',
          position: { x: 250, y: 500 },
          data: { label: 'Attendre 5 jours', delayAmount: 5, delayUnit: 'days' },
        },
        {
          id: '7',
          type: 'condition',
          position: { x: 250, y: 600 },
          data: {
            label: 'A recommande?',
            conditionField: 'hasReordered',
            conditionOperator: 'equals',
            conditionValue: 'false',
          },
        },
        {
          id: '8',
          type: 'email',
          position: { x: 250, y: 700 },
          data: {
            label: 'Incentive 10%',
            subject: 'Votre produit vous manque? 10% de rabais',
            htmlContent: '',
          },
        },
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' },
        { id: 'e3-4', source: '3', target: '4' },
        { id: 'e4-5', source: '4', target: '5', sourceHandle: 'true' },
        { id: 'e5-6', source: '5', target: '6' },
        { id: 'e6-7', source: '6', target: '7' },
        { id: 'e7-8', source: '7', target: '8', sourceHandle: 'true' },
      ],
    },

    // -- 7. Cross-Sell / Upsell -----------------------------------------------
    {
      name: 'Vente croisee / Montee en gamme',
      description: 'Complementaires J7 + Upgrade J14 (mappings peptide-specifiques)',
      trigger: 'order.delivered',
      nodes: [
        {
          id: '1',
          type: 'trigger',
          position: { x: 250, y: 0 },
          data: { label: 'Commande livree', triggerEvent: 'order.delivered' },
        },
        {
          id: '2',
          type: 'delay',
          position: { x: 250, y: 100 },
          data: { label: 'Attendre 7 jours', delayAmount: 7, delayUnit: 'days' },
        },
        {
          id: '3',
          type: 'email',
          position: { x: 250, y: 200 },
          data: {
            label: 'Produits complementaires',
            subject: 'Les clients qui ont achete {{productName}} adorent aussi...',
            htmlContent: '',
          },
        },
        {
          id: '4',
          type: 'delay',
          position: { x: 250, y: 300 },
          data: { label: 'Attendre 7 jours', delayAmount: 7, delayUnit: 'days' },
        },
        {
          id: '5',
          type: 'email',
          position: { x: 250, y: 400 },
          data: {
            label: 'Montee en gamme',
            subject: 'Passez au niveau superieur avec votre protocole',
            htmlContent: '',
          },
        },
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' },
        { id: 'e3-4', source: '3', target: '4' },
        { id: 'e4-5', source: '4', target: '5' },
      ],
    },

    // -- 8. Sunset / List Cleanup ---------------------------------------------
    {
      name: 'Nettoyage de liste (Sunset)',
      description: 'Re-engagement J0 + Derniere chance J7 + Desinscription auto J14',
      trigger: 'sunset.eligible',
      nodes: [
        {
          id: '1',
          type: 'trigger',
          position: { x: 250, y: 0 },
          data: { label: 'Inactif 90j (email)', triggerEvent: 'sunset.eligible' },
        },
        {
          id: '2',
          type: 'email',
          position: { x: 250, y: 100 },
          data: {
            label: 'Vous nous manquez',
            subject: 'Vous nous manquez! Voici les nouveautes',
            htmlContent: '',
          },
        },
        {
          id: '3',
          type: 'delay',
          position: { x: 250, y: 200 },
          data: { label: 'Attendre 7 jours', delayAmount: 7, delayUnit: 'days' },
        },
        {
          id: '4',
          type: 'condition',
          position: { x: 250, y: 300 },
          data: {
            label: 'A ouvert?',
            conditionField: 'emailOpened',
            conditionOperator: 'equals',
            conditionValue: 'false',
          },
        },
        {
          id: '5',
          type: 'email',
          position: { x: 250, y: 400 },
          data: {
            label: 'Derniere chance',
            subject: 'Derniere chance de rester en contact',
            htmlContent: '',
          },
        },
        {
          id: '6',
          type: 'delay',
          position: { x: 250, y: 500 },
          data: { label: 'Attendre 7 jours', delayAmount: 7, delayUnit: 'days' },
        },
        {
          id: '7',
          type: 'condition',
          position: { x: 250, y: 600 },
          data: {
            label: 'A ouvert?',
            conditionField: 'emailOpened',
            conditionOperator: 'equals',
            conditionValue: 'false',
          },
        },
        {
          id: '8',
          type: 'email',
          position: { x: 250, y: 700 },
          data: {
            label: 'Au revoir',
            subject: 'Au revoir pour le moment',
            htmlContent: '',
          },
        },
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' },
        { id: 'e3-4', source: '3', target: '4' },
        { id: 'e4-5', source: '4', target: '5', sourceHandle: 'true' },
        { id: 'e5-6', source: '5', target: '6' },
        { id: 'e6-7', source: '6', target: '7' },
        { id: 'e7-8', source: '7', target: '8', sourceHandle: 'true' },
      ],
    },

    // -- 9. VIP / Loyalty Tier ------------------------------------------------
    {
      name: 'Niveau VIP / Fidelite',
      description: 'Felicitations J0 + Avantages J3 + Acces exclusif J7',
      trigger: 'loyalty.tier_up',
      nodes: [
        {
          id: '1',
          type: 'trigger',
          position: { x: 250, y: 0 },
          data: { label: 'Nouveau niveau fidelite', triggerEvent: 'loyalty.tier_up' },
        },
        {
          id: '2',
          type: 'email',
          position: { x: 250, y: 100 },
          data: {
            label: 'Felicitations',
            subject: 'Felicitations! Vous etes maintenant {{tierName}}!',
            htmlContent: '',
          },
        },
        {
          id: '3',
          type: 'delay',
          position: { x: 250, y: 200 },
          data: { label: 'Attendre 3 jours', delayAmount: 3, delayUnit: 'days' },
        },
        {
          id: '4',
          type: 'email',
          position: { x: 250, y: 300 },
          data: {
            label: 'Avantages detailles',
            subject: 'Vos avantages exclusifs {{tierName}} en detail',
            htmlContent: '',
          },
        },
        {
          id: '5',
          type: 'delay',
          position: { x: 250, y: 400 },
          data: { label: 'Attendre 4 jours', delayAmount: 4, delayUnit: 'days' },
        },
        {
          id: '6',
          type: 'email',
          position: { x: 250, y: 500 },
          data: {
            label: 'Acces exclusif',
            subject: 'Acces VIP anticipe - Produits exclusifs pour vous',
            htmlContent: '',
          },
        },
      ],
      edges: [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' },
        { id: 'e3-4', source: '3', target: '4' },
        { id: 'e4-5', source: '4', target: '5' },
        { id: 'e5-6', source: '5', target: '6' },
      ],
    },
  ];
}

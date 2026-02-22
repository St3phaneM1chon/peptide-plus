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

/** Runtime statistics persisted alongside each flow */
export interface FlowStats {
  triggered: number;
  sent: number;
  opened: number;
  clicked: number;
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
  | 'reorder.due';

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
  context: Record<string, unknown>,
): Promise<void> {
  const flows = await prisma.emailAutomationFlow.findMany({
    where: { trigger: event, isActive: true },
  });

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
      console.error(`[AutomationEngine] Error executing flow ${flow.id}:`, error);
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

async function executeFlowFromNode(
  flowId: string,
  nodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  context: Record<string, unknown>,
  visited: Set<string> = new Set(),
): Promise<void> {
  // Cycle detection + execution budget: prevent infinite recursion and runaway flows
  if (visited.has(nodeId)) return;
  if (visited.size >= FLOW_MAX_NODES) {
    console.warn(`[AutomationEngine] Flow ${flowId}: max node limit (${FLOW_MAX_NODES}) reached, stopping`);
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
    await executeFlowFromNode(flowId, edge.target, nodes, edges, context, visited);
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
  context: Record<string, unknown>,
): Promise<boolean> {
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

      // RGPD compliance: verify active consent before sending marketing emails
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

      const { sendEmail } = await import('@/lib/email/email-service');
      const { generateUnsubscribeUrl } = await import('@/lib/email/unsubscribe');

      const html = replaceVariables(node.data.htmlContent || '', context, true);
      const subject = replaceVariables(node.data.subject, context, false);

      // Generate unsubscribe URL (CAN-SPAM / RGPD / LCAP compliance)
      const unsubscribeUrl = await generateUnsubscribeUrl(
        email,
        'marketing',
        (context.userId as string) || undefined,
      ).catch(() => undefined);

      const result = await sendEmail({
        to: { email, name: (context.name as string) || undefined },
        subject,
        html,
        unsubscribeUrl,
      });

      // Increment 'sent' stat on successful send
      if (result.success && context._flowId) {
        await incrementFlowStat(context._flowId as string, 'sent').catch(() => {});
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
        await prisma.emailFlowExecution.create({
          data: {
            flowId: context._flowId as string,
            email,
            currentNode: node.id,
            context: JSON.stringify(context),
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
      console.log(
        `[AutomationEngine] SMS to ${context.phone ?? 'unknown'}: ${node.data.smsMessage}`,
      );
      // TODO: Integrate Twilio or another SMS provider
      return true;
    }

    // -- Push notification (placeholder) ----------------------------------
    case 'push': {
      console.log(
        `[AutomationEngine] Push: ${node.data.pushTitle} - ${node.data.pushBody}`,
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
  const a = amount || 1;
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
        COALESCE(stats::jsonb, '{"triggered":0,"sent":0,"opened":0,"clicked":0,"revenue":0}'::jsonb),
        ${`{${stat}}`}::text[],
        (COALESCE((stats::jsonb->>${stat})::int, 0) + ${amount})::text::jsonb
      )
      WHERE id = ${flowId}
    `;
  } catch (err) {
    console.error(`[AutomationEngine] Failed to increment stat ${stat} for flow ${flowId}:`, err);
  }
}

/**
 * Replace `{{variable}}` placeholders in a template string with values
 * from the context map. Supports nested dot-notation keys (one level).
 * Unresolved placeholders are left as-is.
 *
 * @param htmlContext If true, values are HTML-escaped to prevent XSS.
 *                   Use false for plain-text contexts like email subjects.
 */
function replaceVariables(
  template: string,
  context: Record<string, unknown>,
  htmlContext: boolean = true,
): string {
  return template.replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (match, key: string) => {
    // Support one level of nesting: "order.total" -> context.order?.total
    const parts = key.split('.');
    let value: unknown = context;
    for (const part of parts) {
      if (value === null || value === undefined) break;
      value = (value as Record<string, unknown>)[part];
    }
    if (value === undefined || value === null) return match;
    const strValue = String(value);
    return htmlContext ? escapeHtml(strValue) : strValue;
  });
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
  ];
}

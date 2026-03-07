/**
 * CRM Data-Directed Call Routing - C13
 *
 * Routes calls based on CRM data (customer history, deal value, language,
 * previous interactions) rather than simple skill matching alone. Similar
 * to Genesys Predictive Routing: uses customer context to find the optimal
 * agent for each interaction.
 *
 * Key routing strategies:
 * - VIP detection: high-value customers get senior agents
 * - Affinity routing: return caller to their previous agent
 * - Language matching: route to agents speaking the caller's language
 * - Lead value: hot leads go to top closers
 * - Timezone: route to agents in the caller's timezone
 *
 * Functions:
 * - routeByData: Main routing entry point — looks up CRM data and routes
 * - buildRoutingRules: Configure data-directed rules for a campaign
 * - evaluateRoutingRules: Evaluate rules in priority order
 * - getCallerData: Look up caller in CRM (lead, orders, activities)
 * - getAffinityAgent: Find the previous agent for continuity
 * - getDataRoutingMetrics: Routing performance metrics
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CallContext {
  /** Caller phone number (for CRM lookup) */
  callerNumber?: string;
  /** Known lead ID (if available from IVR or screen pop) */
  leadId?: string;
  /** Campaign ID (if call originated from a campaign) */
  campaignId?: string;
  /** IVR inputs collected before routing */
  ivrInputs?: Record<string, string>;
  /** Language detected from IVR or browser locale */
  language?: string;
}

export interface CallerData {
  /** CRM Lead record if found */
  lead: {
    id: string;
    contactName: string;
    email: string | null;
    phone: string | null;
    score: number;
    status: string;
    source: string | null;
    tags: string[];
    language?: string;
    timezone?: string;
  } | null;
  /** Total order value across all orders */
  totalOrderValue: number;
  /** Number of previous orders */
  orderCount: number;
  /** Whether this is a VIP customer (based on order value or score) */
  isVip: boolean;
  /** Last agent who handled this caller */
  lastAgentId: string | null;
  /** Last agent's name */
  lastAgentName: string | null;
  /** Last disposition/outcome */
  lastDisposition: string | null;
  /** Number of previous interactions */
  interactionCount: number;
  /** Last contact date */
  lastContactedAt: Date | null;
}

export interface RoutingRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** Rule type */
  type:
    | 'vip'
    | 'affinity'
    | 'language'
    | 'lead_value'
    | 'timezone'
    | 'custom';
  /** Priority (higher = evaluated first) */
  priority: number;
  /** Whether this rule is active */
  enabled: boolean;
  /** Rule condition */
  condition: {
    field: string;
    operator: 'equals' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
    value: string | number | string[];
  };
  /** Target agent IDs, queue, or skill requirement */
  target: {
    type: 'agent' | 'queue' | 'skill';
    value: string;
  };
}

export interface RoutingDecision {
  /** The rule that matched */
  matchedRule: RoutingRule | null;
  /** Target agent ID if specific agent matched */
  agentId: string | null;
  /** Target queue name if routing to queue */
  queueName: string | null;
  /** Caller data that was used for the decision */
  callerData: CallerData;
  /** Confidence in the routing decision (0-1) */
  confidence: number;
  /** Reason for the routing decision */
  reason: string;
}

export interface DataRoutingMetrics {
  /** Total calls routed using data-directed routing */
  totalRouted: number;
  /** Calls where affinity routing matched */
  affinityMatches: number;
  /** Affinity match rate (0-100) */
  affinityMatchRate: number;
  /** VIP calls detected */
  vipDetected: number;
  /** VIP detection rate (0-100) */
  vipDetectionRate: number;
  /** Average time to route in milliseconds */
  avgTimeToRouteMs: number;
  /** Rule match distribution */
  ruleMatchDistribution: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** VIP threshold: orders totaling more than this amount */
const VIP_ORDER_VALUE_THRESHOLD = 1000;

/** VIP threshold: lead score above this */
const VIP_SCORE_THRESHOLD = 80;

/** Maximum days to look back for affinity agent */
const AFFINITY_LOOKBACK_DAYS = 90;

// ---------------------------------------------------------------------------
// routeByData
// ---------------------------------------------------------------------------

/**
 * Route a call based on CRM data lookup.
 *
 * This is the main entry point. It looks up the caller in the CRM,
 * loads the campaign's routing rules, evaluates them in priority order,
 * and returns the routing decision.
 *
 * @param callContext - Information about the incoming call
 * @returns Routing decision with target agent/queue and reason
 */
export async function routeByData(
  callContext: CallContext,
): Promise<RoutingDecision> {
  const startTime = Date.now();

  // Step 1: Look up caller data in CRM
  const callerData = await getCallerData(
    callContext.callerNumber || null,
    callContext.leadId || null,
  );

  // Step 2: Load routing rules for the campaign (or global defaults)
  const rules = callContext.campaignId
    ? await loadCampaignRoutingRules(callContext.campaignId)
    : getDefaultRoutingRules();

  // Step 3: Evaluate rules against caller data
  const decision = await evaluateRoutingRules(rules, callerData, callContext);

  const routingTimeMs = Date.now() - startTime;

  // Step 4: Record the routing decision for metrics
  await recordRoutingDecision(callContext, decision, routingTimeMs);

  logger.info('Data-directed routing: decision made', {
    event: 'data_routing_decision',
    callerNumber: callContext.callerNumber,
    leadId: callerData.lead?.id,
    isVip: callerData.isVip,
    matchedRule: decision.matchedRule?.name || 'none',
    agentId: decision.agentId,
    queueName: decision.queueName,
    confidence: decision.confidence,
    reason: decision.reason,
    routingTimeMs,
  });

  return decision;
}

// ---------------------------------------------------------------------------
// buildRoutingRules
// ---------------------------------------------------------------------------

/**
 * Configure data-directed routing rules for a campaign.
 *
 * Rules are stored in the campaign's targetCriteria JSON field.
 * Each rule has a condition, priority, and target (agent, queue, or skill).
 *
 * @param campaignId - The campaign to configure
 * @param rules - Array of routing rules to set
 * @returns The saved rules
 */
export async function buildRoutingRules(
  campaignId: string,
  rules: RoutingRule[],
): Promise<RoutingRule[]> {
  const campaign = await prisma.crmCampaign.findUniqueOrThrow({
    where: { id: campaignId },
    select: { targetCriteria: true },
  });

  const meta = (campaign.targetCriteria as Record<string, unknown>) || {};

  // Sort rules by priority descending
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);
  meta.dataRoutingRules = sortedRules;

  await prisma.crmCampaign.update({
    where: { id: campaignId },
    data: {
      targetCriteria: meta as unknown as Prisma.InputJsonValue,
    },
  });

  logger.info('Data-directed routing: rules configured', {
    event: 'data_routing_rules_saved',
    campaignId,
    ruleCount: sortedRules.length,
    ruleNames: sortedRules.map((r) => r.name),
  });

  return sortedRules;
}

// ---------------------------------------------------------------------------
// evaluateRoutingRules
// ---------------------------------------------------------------------------

/**
 * Evaluate routing rules in priority order against caller data.
 *
 * Rules are evaluated from highest priority to lowest. The first matching
 * rule determines the routing decision. If no rules match, a default
 * routing to the general queue is returned.
 *
 * @param rules - Routing rules sorted by priority
 * @param callerData - Caller's CRM data
 * @param callContext - Additional call context
 * @returns The routing decision
 */
export async function evaluateRoutingRules(
  rules: RoutingRule[],
  callerData: CallerData,
  callContext?: CallContext,
): Promise<RoutingDecision> {
  // Pre-fetch availability for all agent targets + affinity agent to avoid N+1
  const agentUserIds = new Set<string>();
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.target.type === 'agent') agentUserIds.add(rule.target.value);
    if (rule.type === 'affinity' && callerData.lastAgentId) agentUserIds.add(callerData.lastAgentId);
  }

  const availableExtensions = agentUserIds.size > 0
    ? await prisma.sipExtension.findMany({
        where: {
          userId: { in: [...agentUserIds] },
          status: { in: ['ONLINE', 'BUSY'] },
        },
        select: { userId: true, status: true },
      })
    : [];

  // Maps for quick lookup
  const agentOnlineOrBusy = new Set(availableExtensions.map(e => e.userId).filter(Boolean));
  const agentOnlineOnly = new Set(
    availableExtensions.filter(e => e.status === 'ONLINE').map(e => e.userId).filter(Boolean)
  );

  // Evaluate each rule in priority order
  for (const rule of rules) {
    if (!rule.enabled) continue;

    const matches = evaluateSingleRule(rule, callerData, callContext);

    if (matches) {
      // Determine target agent or queue
      let agentId: string | null = null;
      let queueName: string | null = null;

      if (rule.target.type === 'agent') {
        // Check if the target agent is available (using pre-fetched data)
        agentId = agentOnlineOrBusy.has(rule.target.value) ? rule.target.value : null;
        if (!agentId) {
          // Agent not available, continue to next rule
          continue;
        }
      } else if (rule.target.type === 'queue') {
        queueName = rule.target.value;
      }

      // Special handling for affinity routing
      if (rule.type === 'affinity' && callerData.lastAgentId) {
        if (agentOnlineOnly.has(callerData.lastAgentId)) {
          agentId = callerData.lastAgentId;
        } else {
          // Affinity agent not available, skip this rule
          continue;
        }
      }

      return {
        matchedRule: rule,
        agentId,
        queueName,
        callerData,
        confidence: 0.9,
        reason: `Matched rule: ${rule.name} (${rule.type})`,
      };
    }
  }

  // No rules matched — default routing
  return {
    matchedRule: null,
    agentId: null,
    queueName: 'general',
    callerData,
    confidence: 0.5,
    reason: 'No data-directed rules matched; routed to general queue',
  };
}

// ---------------------------------------------------------------------------
// getCallerData
// ---------------------------------------------------------------------------

/**
 * Look up a caller's CRM data by phone number or lead ID.
 *
 * Queries CrmLead, Order history, CrmActivity, and CallLog to build
 * a comprehensive profile of the caller for routing decisions.
 *
 * @param callerNumber - The caller's phone number
 * @param leadId - Known lead ID (if available)
 * @returns Comprehensive caller data
 */
export async function getCallerData(
  callerNumber: string | null,
  leadId: string | null,
): Promise<CallerData> {
  const emptyResult: CallerData = {
    lead: null,
    totalOrderValue: 0,
    orderCount: 0,
    isVip: false,
    lastAgentId: null,
    lastAgentName: null,
    lastDisposition: null,
    interactionCount: 0,
    lastContactedAt: null,
  };

  if (!callerNumber && !leadId) return emptyResult;

  // Find the lead
  let lead;
  if (leadId) {
    lead = await prisma.crmLead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        contactName: true,
        email: true,
        phone: true,
        score: true,
        status: true,
        source: true,
        tags: true,
        customFields: true,
        lastContactedAt: true,
      },
    });
  }

  if (!lead && callerNumber) {
    lead = await prisma.crmLead.findFirst({
      where: { phone: callerNumber },
      select: {
        id: true,
        contactName: true,
        email: true,
        phone: true,
        score: true,
        status: true,
        source: true,
        tags: true,
        customFields: true,
        lastContactedAt: true,
      },
    });
  }

  if (!lead) return emptyResult;

  // Extract language and timezone from customFields
  const customFields = (lead.customFields as Record<string, unknown>) || {};

  // Get order history via the lead's email
  let totalOrderValue = 0;
  let orderCount = 0;

  if (lead.email) {
    const user = await prisma.user.findUnique({
      where: { email: lead.email },
      select: { id: true },
    });

    if (user) {
      const orderAgg = await prisma.order.aggregate({
        where: { userId: user.id },
        _sum: { total: true },
        _count: { id: true },
      });
      totalOrderValue = orderAgg._sum.total?.toNumber() || 0;
      orderCount = orderAgg._count.id;
    }
  }

  // Get last agent from CrmActivity
  const lastActivity = await prisma.crmActivity.findFirst({
    where: {
      leadId: lead.id,
      type: 'CALL',
      performedById: { not: null },
    },
    select: {
      performedById: true,
      description: true,
      createdAt: true,
      performedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Count total interactions
  const interactionCount = await prisma.crmActivity.count({
    where: { leadId: lead.id },
  });

  // Determine VIP status
  const isVip =
    totalOrderValue >= VIP_ORDER_VALUE_THRESHOLD ||
    lead.score >= VIP_SCORE_THRESHOLD ||
    lead.tags.includes('VIP');

  return {
    lead: {
      id: lead.id,
      contactName: lead.contactName,
      email: lead.email,
      phone: lead.phone,
      score: lead.score,
      status: lead.status,
      source: lead.source,
      tags: lead.tags,
      language: customFields.language as string | undefined,
      timezone: customFields.timezone as string | undefined,
    },
    totalOrderValue,
    orderCount,
    isVip,
    lastAgentId: lastActivity?.performedById || null,
    lastAgentName: lastActivity?.performedBy?.name || null,
    lastDisposition: lastActivity?.description || null,
    interactionCount,
    lastContactedAt: lead.lastContactedAt,
  };
}

// ---------------------------------------------------------------------------
// getAffinityAgent
// ---------------------------------------------------------------------------

/**
 * Find the previous agent who handled this lead for continuity routing.
 *
 * Affinity routing connects returning callers to the same agent they
 * spoke with previously, improving customer experience and reducing
 * the need to re-explain context.
 *
 * @param leadId - The CRM lead ID
 * @returns Previous agent info or null
 */
export async function getAffinityAgent(
  leadId: string,
): Promise<{
  agentId: string;
  agentName: string;
  lastInteractionAt: Date;
  isAvailable: boolean;
} | null> {
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - AFFINITY_LOOKBACK_DAYS);

  // Find the most recent activity with an assigned agent
  const lastActivity = await prisma.crmActivity.findFirst({
    where: {
      leadId,
      type: 'CALL',
      performedById: { not: null },
      createdAt: { gte: lookbackDate },
    },
    select: {
      performedById: true,
      createdAt: true,
      performedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!lastActivity?.performedById) return null;

  // Check if agent is currently available
  const extension = await prisma.sipExtension.findFirst({
    where: {
      userId: lastActivity.performedById,
      status: 'ONLINE',
    },
    select: { id: true },
  });

  logger.debug('Data-directed routing: affinity agent lookup', {
    event: 'data_routing_affinity',
    leadId,
    agentId: lastActivity.performedById,
    agentName: lastActivity.performedBy?.name,
    isAvailable: !!extension,
    lastInteraction: lastActivity.createdAt.toISOString(),
  });

  return {
    agentId: lastActivity.performedById,
    agentName: lastActivity.performedBy?.name || 'Unknown',
    lastInteractionAt: lastActivity.createdAt,
    isAvailable: !!extension,
  };
}

// ---------------------------------------------------------------------------
// getDataRoutingMetrics
// ---------------------------------------------------------------------------

/**
 * Get data-directed routing performance metrics for a time period.
 *
 * @param period - Time period for metrics
 * @returns Routing performance metrics
 */
export async function getDataRoutingMetrics(period: {
  start: Date;
  end: Date;
}): Promise<DataRoutingMetrics> {
  // Query routing decisions from CrmActivity entries tagged with data_routing
  const activities = await prisma.crmActivity.findMany({
    where: {
      type: 'CALL',
      createdAt: {
        gte: period.start,
        lte: period.end,
      },
      description: { startsWith: 'data_routing:' },
    },
    select: {
      metadata: true,
    },
    take: 1000,
  });

  let totalRouted = 0;
  let affinityMatches = 0;
  let vipDetected = 0;
  let totalRouteTimeMs = 0;
  const ruleMatchDistribution: Record<string, number> = {};

  for (const activity of activities) {
    const meta = (activity.metadata as Record<string, unknown>) || {};
    totalRouted++;

    const ruleType = meta.ruleType as string | undefined;
    const isVip = meta.isVip as boolean | undefined;
    const routingTimeMs = meta.routingTimeMs as number | undefined;

    if (ruleType === 'affinity') {
      affinityMatches++;
    }

    if (isVip) {
      vipDetected++;
    }

    if (routingTimeMs) {
      totalRouteTimeMs += routingTimeMs;
    }

    if (ruleType) {
      ruleMatchDistribution[ruleType] =
        (ruleMatchDistribution[ruleType] || 0) + 1;
    }
  }

  const affinityMatchRate =
    totalRouted > 0
      ? Math.round((affinityMatches / totalRouted) * 1000) / 10
      : 0;

  const vipDetectionRate =
    totalRouted > 0
      ? Math.round((vipDetected / totalRouted) * 1000) / 10
      : 0;

  const avgTimeToRouteMs =
    totalRouted > 0 ? Math.round(totalRouteTimeMs / totalRouted) : 0;

  logger.info('Data-directed routing: metrics calculated', {
    event: 'data_routing_metrics',
    totalRouted,
    affinityMatches,
    vipDetected,
    affinityMatchRate,
    vipDetectionRate,
    avgTimeToRouteMs,
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
  });

  return {
    totalRouted,
    affinityMatches,
    affinityMatchRate,
    vipDetected,
    vipDetectionRate,
    avgTimeToRouteMs,
    ruleMatchDistribution,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Evaluate a single routing rule against caller data.
 */
function evaluateSingleRule(
  rule: RoutingRule,
  callerData: CallerData,
  callContext?: CallContext,
): boolean {
  const { field, operator, value } = rule.condition;

  // Get the actual value from caller data or call context
  let actualValue: unknown;

  switch (field) {
    case 'isVip':
      actualValue = callerData.isVip;
      break;
    case 'score':
      actualValue = callerData.lead?.score || 0;
      break;
    case 'totalOrderValue':
      actualValue = callerData.totalOrderValue;
      break;
    case 'orderCount':
      actualValue = callerData.orderCount;
      break;
    case 'status':
      actualValue = callerData.lead?.status;
      break;
    case 'source':
      actualValue = callerData.lead?.source;
      break;
    case 'tags':
      actualValue = callerData.lead?.tags || [];
      break;
    case 'language':
      actualValue = callerData.lead?.language || callContext?.language;
      break;
    case 'timezone':
      actualValue = callerData.lead?.timezone;
      break;
    case 'hasAffinityAgent':
      actualValue = !!callerData.lastAgentId;
      break;
    case 'interactionCount':
      actualValue = callerData.interactionCount;
      break;
    default:
      return false;
  }

  // Evaluate the condition
  switch (operator) {
    case 'equals':
      return String(actualValue) === String(value);
    case 'gt':
      return Number(actualValue) > Number(value);
    case 'lt':
      return Number(actualValue) < Number(value);
    case 'gte':
      return Number(actualValue) >= Number(value);
    case 'lte':
      return Number(actualValue) <= Number(value);
    case 'contains':
      if (Array.isArray(actualValue)) {
        return actualValue.includes(String(value));
      }
      return String(actualValue).includes(String(value));
    case 'in':
      if (Array.isArray(value)) {
        return value.includes(String(actualValue));
      }
      return false;
    default:
      return false;
  }
}

/**
 * Load routing rules from a campaign's targetCriteria JSON.
 */
async function loadCampaignRoutingRules(
  campaignId: string,
): Promise<RoutingRule[]> {
  const campaign = await prisma.crmCampaign.findUnique({
    where: { id: campaignId },
    select: { targetCriteria: true },
  });

  const meta = (campaign?.targetCriteria as Record<string, unknown>) || {};
  const rules = (meta.dataRoutingRules as RoutingRule[]) || [];

  if (rules.length === 0) {
    return getDefaultRoutingRules();
  }

  return rules.sort((a, b) => b.priority - a.priority);
}

/**
 * Get default routing rules when no campaign-specific rules are configured.
 */
function getDefaultRoutingRules(): RoutingRule[] {
  return [
    {
      id: 'default-vip',
      name: 'VIP Customer Priority',
      type: 'vip',
      priority: 100,
      enabled: true,
      condition: { field: 'isVip', operator: 'equals', value: 'true' },
      target: { type: 'queue', value: 'vip_priority' },
    },
    {
      id: 'default-affinity',
      name: 'Return Caller Affinity',
      type: 'affinity',
      priority: 90,
      enabled: true,
      condition: { field: 'hasAffinityAgent', operator: 'equals', value: 'true' },
      target: { type: 'queue', value: 'affinity' },
    },
    {
      id: 'default-high-value',
      name: 'High Value Lead',
      type: 'lead_value',
      priority: 80,
      enabled: true,
      condition: { field: 'score', operator: 'gte', value: 70 },
      target: { type: 'queue', value: 'sales_priority' },
    },
  ];
}

/**
 * Record a routing decision for metrics tracking.
 */
async function recordRoutingDecision(
  callContext: CallContext,
  decision: RoutingDecision,
  routingTimeMs: number,
): Promise<void> {
  try {
    if (!decision.callerData.lead) return;

    await prisma.crmActivity.create({
      data: {
        type: 'CALL',
        title: `Data routing: ${decision.matchedRule?.name || 'default'}`,
        leadId: decision.callerData.lead.id,
        description: `data_routing: ${decision.reason}`,
        metadata: {
          source: 'data_routing',
          ruleType: decision.matchedRule?.type || 'default',
          ruleName: decision.matchedRule?.name || 'none',
          agentId: decision.agentId,
          queueName: decision.queueName,
          isVip: decision.callerData.isVip,
          confidence: decision.confidence,
          routingTimeMs,
          campaignId: callContext.campaignId,
        },
      },
    });
  } catch (error) {
    logger.debug('Data-directed routing: failed to record decision', {
      event: 'data_routing_record_error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * LEAD ASSIGNMENT STRATEGIES
 * Round-robin and auto-assignment of leads to agents.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Assign a lead to the agent (from `agentIds`) who currently has the fewest
 * assigned leads with status NEW or CONTACTED (round-robin by workload).
 *
 * Updates `CrmLead.assignedToId` and returns the chosen agent ID.
 */
export async function assignLeadRoundRobin(
  leadId: string,
  agentIds: string[],
): Promise<string> {
  if (agentIds.length === 0) {
    throw new Error('assignLeadRoundRobin: agentIds array is empty');
  }

  // Count active leads per agent
  const counts = await prisma.crmLead.groupBy({
    by: ['assignedToId'],
    where: {
      assignedToId: { in: agentIds },
      status: { in: ['NEW', 'CONTACTED'] },
    },
    _count: { id: true },
  });

  // Build a map agentId -> count
  const countMap = new Map<string, number>();
  for (const agentId of agentIds) {
    countMap.set(agentId, 0);
  }
  for (const row of counts) {
    if (row.assignedToId) {
      countMap.set(row.assignedToId, row._count.id);
    }
  }

  // Pick the agent with the fewest leads
  let chosenId = agentIds[0];
  let minCount = Infinity;
  for (const [agentId, count] of countMap.entries()) {
    if (count < minCount) {
      minCount = count;
      chosenId = agentId;
    }
  }

  // Update lead
  await prisma.crmLead.update({
    where: { id: leadId },
    data: { assignedToId: chosenId },
  });

  logger.info('Lead assigned via round-robin', { leadId, agentId: chosenId, agentLoad: minCount });
  return chosenId;
}

/**
 * Automatically assign a lead by picking from all users with role EMPLOYEE
 * using round-robin.  Returns the assigned agent ID, or `null` if no agents
 * are available.
 */
export async function autoAssignLead(leadId: string): Promise<string | null> {
  const agents = await prisma.user.findMany({
    where: { role: 'EMPLOYEE' },
    select: { id: true },
  });

  if (agents.length === 0) {
    logger.warn('autoAssignLead: no agents with role EMPLOYEE found', { leadId });
    return null;
  }

  const agentIds = agents.map((a) => a.id);
  return assignLeadRoundRobin(leadId, agentIds);
}

// ---------------------------------------------------------------------------
// Bulk assignment result type
// ---------------------------------------------------------------------------

export interface BulkAssignmentResult {
  assigned: number;
  assignments: { leadId: string; agentId: string }[];
}

// ---------------------------------------------------------------------------
// Bulk Round-Robin
// ---------------------------------------------------------------------------

/**
 * Assign multiple leads to agents in circular order.
 */
export async function assignLeadsBulkRoundRobin(
  leadIds: string[],
  agentIds: string[],
  startIndex = 0,
): Promise<BulkAssignmentResult & { nextIndex: number }> {
  if (agentIds.length === 0) return { assigned: 0, assignments: [], nextIndex: 0 };

  const assignments: { leadId: string; agentId: string }[] = [];
  let idx = startIndex % agentIds.length;

  for (const leadId of leadIds) {
    assignments.push({ leadId, agentId: agentIds[idx] });
    idx = (idx + 1) % agentIds.length;
  }

  await applyBulkAssignments(assignments);
  return { assigned: assignments.length, assignments, nextIndex: idx };
}

// ---------------------------------------------------------------------------
// Bulk Load-Balanced
// ---------------------------------------------------------------------------

/**
 * Assign leads to agents with the fewest open deals first.
 */
export async function assignLeadsLoadBalanced(
  leadIds: string[],
  agentIds: string[],
): Promise<BulkAssignmentResult> {
  if (agentIds.length === 0) return { assigned: 0, assignments: [] };

  const workloads = await getAgentWorkload(agentIds);
  const sorted = [...workloads].sort((a, b) => a.openDeals - b.openDeals);

  const assignments: { leadId: string; agentId: string }[] = [];
  for (let i = 0; i < leadIds.length; i++) {
    assignments.push({ leadId: leadIds[i], agentId: sorted[i % sorted.length].agentId });
  }

  await applyBulkAssignments(assignments);
  return { assigned: assignments.length, assignments };
}

// ---------------------------------------------------------------------------
// Bulk Score-Based
// ---------------------------------------------------------------------------

/**
 * Best leads (highest score) go to senior agents (first in agentIds).
 */
export async function assignLeadsScoreBased(
  leadIds: string[],
  agentIds: string[],
): Promise<BulkAssignmentResult> {
  if (agentIds.length === 0) return { assigned: 0, assignments: [] };

  const leads = await prisma.crmLead.findMany({
    where: { id: { in: leadIds } },
    select: { id: true, score: true },
    orderBy: { score: 'desc' },
  });

  const assignments: { leadId: string; agentId: string }[] = [];
  const leadsPerAgent = Math.ceil(leads.length / agentIds.length);

  for (let i = 0; i < leads.length; i++) {
    const agentIdx = Math.min(Math.floor(i / leadsPerAgent), agentIds.length - 1);
    assignments.push({ leadId: leads[i].id, agentId: agentIds[agentIdx] });
  }

  await applyBulkAssignments(assignments);
  return { assigned: assignments.length, assignments };
}

// ---------------------------------------------------------------------------
// Bulk Manual
// ---------------------------------------------------------------------------

/**
 * Assign all leads to a single agent.
 */
export async function assignLeadsManual(
  leadIds: string[],
  agentId: string,
): Promise<BulkAssignmentResult> {
  const assignments = leadIds.map((leadId) => ({ leadId, agentId }));
  await applyBulkAssignments(assignments);
  return { assigned: assignments.length, assignments };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export async function getAgentWorkload(
  agentIds: string[],
): Promise<{ agentId: string; name: string | null; openDeals: number }[]> {
  return Promise.all(
    agentIds.map(async (agentId) => {
      const [user, dealCount] = await Promise.all([
        prisma.user.findUnique({ where: { id: agentId }, select: { name: true } }),
        prisma.crmDeal.count({
          where: {
            assignedToId: agentId,
            stage: { isWon: false, isLost: false },
          },
        }),
      ]);
      return { agentId, name: user?.name ?? null, openDeals: dealCount };
    }),
  );
}

async function applyBulkAssignments(assignments: { leadId: string; agentId: string }[]): Promise<void> {
  if (assignments.length === 0) return;

  const byAgent = new Map<string, string[]>();
  for (const a of assignments) {
    if (!byAgent.has(a.agentId)) byAgent.set(a.agentId, []);
    byAgent.get(a.agentId)!.push(a.leadId);
  }

  const ops = [];
  for (const [agentId, ids] of byAgent) {
    ops.push(
      prisma.crmLead.updateMany({
        where: { id: { in: ids } },
        data: { assignedToId: agentId },
      }),
    );
  }
  await prisma.$transaction(ops);
}

/**
 * CRM ACD Engine - C14
 *
 * Automatic Call Distribution with priority queues and overflow handling.
 * Routes incoming calls to the appropriate queue, manages priority levels
 * (VIP, HIGH, NORMAL, LOW), and handles overflow when queues are full
 * or wait times exceed thresholds.
 *
 * Functions:
 * - routeCall: Route an incoming call to the best queue and agent
 * - handleQueueOverflow: Process overflow when queue limits are exceeded
 * - getQueuePosition: Get a caller's position in the queue
 * - calculateEstimatedWait: Calculate estimated wait time for a queue
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PriorityLevel = 'VIP' | 'HIGH' | 'NORMAL' | 'LOW';

interface CallRoutingData {
  callLogId: string;
  callerNumber: string;
  calledNumber: string;
  clientId?: string;
  queueId?: string;
  priority?: PriorityLevel;
}

interface RoutingResult {
  action: 'agent' | 'queue' | 'overflow' | 'voicemail';
  agentId?: string;
  queueId?: string;
  position?: number;
  estimatedWait?: number;  // seconds
  overflowTarget?: string;
}

interface QueuedCall {
  callLogId: string;
  priority: PriorityLevel;
  enqueuedAt: Date;
}

// ---------------------------------------------------------------------------
// Priority weights (higher = served first)
// ---------------------------------------------------------------------------

const PRIORITY_WEIGHTS: Record<PriorityLevel, number> = {
  VIP: 40,
  HIGH: 30,
  NORMAL: 20,
  LOW: 10,
};

// ---------------------------------------------------------------------------
// In-memory queue state
// In production, this should be backed by Redis for multi-instance support.
// ---------------------------------------------------------------------------

const queueState = new Map<string, QueuedCall[]>();

// ---------------------------------------------------------------------------
// determinePriority
// ---------------------------------------------------------------------------

/**
 * Determine call priority based on caller identity.
 *
 * Checks the client's loyalty tier and role to assign a priority level:
 * - VIP/DIAMOND tier or ADMIN/OWNER role -> VIP
 * - GOLD/PLATINUM tier -> HIGH
 * - Default -> NORMAL
 *
 * @param clientId - The caller's user ID (if identified)
 * @returns The priority level
 */
async function determinePriority(clientId?: string): Promise<PriorityLevel> {
  if (!clientId) return 'NORMAL';

  const user = await prisma.user.findUnique({
    where: { id: clientId },
    select: { loyaltyTier: true, role: true },
  });

  if (!user) return 'NORMAL';

  // Admin/Owner always gets VIP treatment
  if (user.role === 'OWNER') {
    return 'VIP';
  }

  // Map loyalty tier to priority
  const tierMap: Record<string, PriorityLevel> = {
    DIAMOND: 'VIP',
    PLATINUM: 'HIGH',
    GOLD: 'HIGH',
    SILVER: 'NORMAL',
    BRONZE: 'NORMAL',
  };

  return tierMap[user.loyaltyTier] ?? 'NORMAL';
}

// ---------------------------------------------------------------------------
// routeCall
// ---------------------------------------------------------------------------

/**
 * Route an incoming call to the best available agent or queue.
 *
 * Routing logic:
 * 1. Determine caller priority (VIP, HIGH, NORMAL, LOW)
 * 2. Find the target queue (explicit or first active queue)
 * 3. Check for available agents in the queue
 * 4. If agent available -> direct connect
 * 5. If no agent -> enqueue with priority
 * 6. If queue full -> overflow handling
 *
 * @param callData - The incoming call routing data
 * @returns Routing result with action and details
 */
export async function routeCall(callData: CallRoutingData): Promise<RoutingResult> {
  // Determine priority
  const priority = callData.priority ?? await determinePriority(callData.clientId);

  // Find target queue
  let queue;
  if (callData.queueId) {
    queue = await prisma.callQueue.findUnique({
      where: { id: callData.queueId },
      include: { members: { include: { user: { select: { id: true, name: true, email: true, image: true, role: true } } } } },
    });
  } else {
    // Default: first active queue
    queue = await prisma.callQueue.findFirst({
      where: { isActive: true },
      include: { members: { include: { user: { select: { id: true, name: true, email: true, image: true, role: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  if (!queue) {
    logger.warn('ACD: no queue available for routing', {
      event: 'acd_no_queue',
      callLogId: callData.callLogId,
      callerNumber: callData.callerNumber,
    });
    return { action: 'voicemail' };
  }

  // Check for available agents in this queue
  const memberUserIds = queue.members.map((m) => m.userId);

  if (memberUserIds.length > 0) {
    const availableExtensions = await prisma.sipExtension.findMany({
      where: {
        userId: { in: memberUserIds },
        status: 'ONLINE',
      },
      select: { userId: true },
    });

    if (availableExtensions.length > 0) {
      // Route to the first available agent (could be enhanced with skills)
      const agentId = availableExtensions[0].userId;

      logger.info('ACD: routed to available agent', {
        event: 'acd_agent_routed',
        callLogId: callData.callLogId,
        agentId,
        queueId: queue.id,
        priority,
      });

      return {
        action: 'agent',
        agentId,
        queueId: queue.id,
      };
    }
  }

  // No agent available - check queue capacity
  const currentQueue = queueState.get(queue.id) ?? [];

  // Check if queue wait time exceeds max
  if (currentQueue.length > 0) {
    const oldestCall = currentQueue[0];
    const waitSec = (Date.now() - oldestCall.enqueuedAt.getTime()) / 1000;

    if (waitSec >= queue.maxWaitTime) {
      return handleQueueOverflow(queue.id);
    }
  }

  // Enqueue the call with priority sorting
  const newEntry: QueuedCall = {
    callLogId: callData.callLogId,
    priority,
    enqueuedAt: new Date(),
  };

  currentQueue.push(newEntry);

  // Sort by priority weight (descending), then by enqueue time (ascending)
  currentQueue.sort((a, b) => {
    const weightDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
    if (weightDiff !== 0) return weightDiff;
    return a.enqueuedAt.getTime() - b.enqueuedAt.getTime();
  });

  queueState.set(queue.id, currentQueue);

  const position = currentQueue.findIndex((c) => c.callLogId === callData.callLogId) + 1;
  const estimatedWait = await calculateEstimatedWait(queue.id);

  logger.info('ACD: call enqueued', {
    event: 'acd_enqueued',
    callLogId: callData.callLogId,
    queueId: queue.id,
    queueName: queue.name,
    priority,
    position,
    estimatedWait,
    queueSize: currentQueue.length,
  });

  return {
    action: 'queue',
    queueId: queue.id,
    position,
    estimatedWait,
  };
}

// ---------------------------------------------------------------------------
// handleQueueOverflow
// ---------------------------------------------------------------------------

/**
 * Handle overflow when a queue exceeds its capacity or max wait time.
 *
 * Overflow actions are configured on the CallQueue model:
 * - "voicemail": Send to voicemail
 * - "ivr": Transfer to an IVR menu
 * - "extension": Transfer to a specific extension
 *
 * @param queueId - The overflowing queue ID
 * @returns Routing result for the overflow action
 */
export async function handleQueueOverflow(queueId: string): Promise<RoutingResult> {
  const queue = await prisma.callQueue.findUnique({
    where: { id: queueId },
    select: {
      id: true,
      name: true,
      overflowAction: true,
      overflowTarget: true,
    },
  });

  if (!queue) {
    return { action: 'voicemail' };
  }

  logger.info('ACD: queue overflow triggered', {
    event: 'acd_overflow',
    queueId,
    queueName: queue.name,
    overflowAction: queue.overflowAction,
    overflowTarget: queue.overflowTarget,
  });

  switch (queue.overflowAction) {
    case 'voicemail':
      return { action: 'voicemail' };

    case 'ivr':
    case 'extension':
      return {
        action: 'overflow',
        overflowTarget: queue.overflowTarget ?? undefined,
      };

    default:
      return { action: 'voicemail' };
  }
}

// ---------------------------------------------------------------------------
// getQueuePosition
// ---------------------------------------------------------------------------

/**
 * Get a caller's current position in the queue.
 *
 * @param callLogId - The call log ID to look up
 * @returns Position (1-based) or null if not in any queue
 */
export function getQueuePosition(
  callLogId: string
): { queueId: string; position: number; total: number } | null {
  for (const [queueId, calls] of queueState.entries()) {
    const idx = calls.findIndex((c) => c.callLogId === callLogId);
    if (idx !== -1) {
      return {
        queueId,
        position: idx + 1,
        total: calls.length,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// calculateEstimatedWait
// ---------------------------------------------------------------------------

/**
 * Calculate the estimated wait time (EWT) for a queue.
 *
 * Uses a simplified model based on recent call handling times:
 * EWT = (queue position * average handle time) / number of agents
 *
 * For more accurate Erlang-C based EWT, see virtual-hold.ts.
 *
 * @param queueId - The queue to calculate EWT for
 * @returns Estimated wait time in seconds
 */
export async function calculateEstimatedWait(queueId: string): Promise<number> {
  const currentQueue = queueState.get(queueId) ?? [];

  if (currentQueue.length === 0) return 0;

  // Get average call duration from recent completed calls
  const recentCalls = await prisma.callLog.findMany({
    where: {
      queue: queueId,
      status: 'COMPLETED',
      duration: { not: null },
    },
    select: { duration: true },
    orderBy: { endedAt: 'desc' },
    take: 50,
  });

  const avgDuration = recentCalls.length > 0
    ? recentCalls.reduce((sum, c) => sum + (c.duration ?? 0), 0) / recentCalls.length
    : 180; // Default 3 min if no data

  // Count available agents in queue
  const queueMembers = await prisma.callQueueMember.findMany({
    where: { queueId },
    select: { userId: true },
  });

  const onlineAgents = queueMembers.length > 0
    ? await prisma.sipExtension.count({
        where: {
          userId: { in: queueMembers.map((m) => m.userId) },
          status: { in: ['ONLINE', 'BUSY'] },
        },
      })
    : 1;

  const agentCount = Math.max(1, onlineAgents);
  const estimatedWait = Math.round((currentQueue.length * avgDuration) / agentCount);

  return estimatedWait;
}

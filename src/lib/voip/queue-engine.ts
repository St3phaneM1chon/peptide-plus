/**
 * Queue Engine — Call Queue Management
 *
 * Features:
 * - Ring strategies: RING_ALL, ROUND_ROBIN, HUNT, LEAST_RECENT, RANDOM
 * - Hold music via TTS announcements
 * - Position announcements every N seconds
 * - Overflow to voicemail/IVR after max wait
 * - Wrap-up time between calls
 * - Agent availability via PresenceStatus
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import * as telnyx from '@/lib/telnyx';

// In-memory queue state (Redis later)
interface QueuedCall {
  callControlId: string;
  queueId: string;
  enteredAt: Date;
  position: number;
  lastAnnounceAt: Date;
  ringAttempts: number;
  currentAgentIndex: number; // For round-robin/hunt
}

const queuedCalls = new Map<string, QueuedCall>();

// Track last agent that answered per queue (for round-robin)
const lastAgentPerQueue = new Map<string, number>();

/**
 * Route a call to a queue by name or ID.
 */
export async function routeToQueue(
  callControlId: string,
  queueNameOrId: string
): Promise<void> {
  const queue = await prisma.callQueue.findFirst({
    where: {
      OR: [
        { id: queueNameOrId },
        { name: queueNameOrId },
      ],
      isActive: true,
    },
    include: {
      members: {
        include: {
          user: {
            include: {
              presenceStatuses: true,
              sipExtensions: true,
            },
          },
        },
        orderBy: { priority: 'asc' },
      },
    },
  });

  if (!queue) {
    logger.warn('[Queue] Queue not found', { queueNameOrId });
    await telnyx.speakText(callControlId,
      "Le département demandé n'est pas disponible. Veuillez rappeler plus tard.");
    await telnyx.hangupCall(callControlId);
    return;
  }

  // Get available agents
  const availableAgents = getAvailableAgents(queue.members);

  if (availableAgents.length === 0) {
    logger.info('[Queue] No agents available', { queueId: queue.id });
    await handleOverflow(callControlId, queue);
    return;
  }

  // Add to queue tracking
  const position = queuedCalls.size + 1;
  queuedCalls.set(callControlId, {
    callControlId,
    queueId: queue.id,
    enteredAt: new Date(),
    position,
    lastAnnounceAt: new Date(),
    ringAttempts: 0,
    currentAgentIndex: lastAgentPerQueue.get(queue.id) || 0,
  });

  // Announce position if enabled
  if (queue.announcePosition) {
    await announcePosition(callControlId, position);
  }

  // Ring agents based on strategy
  await ringAgents(callControlId, queue, availableAgents);
}

/**
 * Get agents that are currently available (ONLINE status).
 */
function getAvailableAgents(members: Array<{
  id: string;
  userId: string;
  priority: number;
  user: {
    id: string;
    presenceStatuses: Array<{ status: string }>;
    sipExtensions: Array<{ extension: string; sipUsername: string; isRegistered: boolean }>;
  };
}>) {
  return members.filter(member => {
    const hasOnlinePresence = member.user.presenceStatuses.some(
      p => p.status === 'ONLINE'
    );
    const hasRegisteredExt = member.user.sipExtensions.some(
      e => e.isRegistered
    );
    return hasOnlinePresence || hasRegisteredExt;
  });
}

/**
 * Ring agents based on queue strategy.
 */
async function ringAgents(
  callControlId: string,
  queue: {
    id: string;
    strategy: string;
    ringTimeout: number;
    maxWaitTime: number;
    overflowAction: string;
    overflowTarget?: string | null;
  },
  agents: Array<{
    id: string;
    userId: string;
    priority: number;
    user: {
      id: string;
      sipExtensions: Array<{ extension: string; sipUsername: string }>;
    };
  }>
): Promise<void> {
  if (agents.length === 0) {
    await handleOverflow(callControlId, queue);
    return;
  }

  const state = queuedCalls.get(callControlId);
  if (!state) return;

  // Check max wait time
  const elapsed = (Date.now() - state.enteredAt.getTime()) / 1000;
  if (elapsed > queue.maxWaitTime) {
    logger.info('[Queue] Max wait exceeded', { callControlId, elapsed });
    await handleOverflow(callControlId, queue);
    return;
  }

  switch (queue.strategy) {
    case 'RING_ALL':
      await ringAll(callControlId, agents, queue.ringTimeout);
      break;

    case 'ROUND_ROBIN':
      await ringRoundRobin(callControlId, agents, queue);
      break;

    case 'HUNT':
      await ringHunt(callControlId, agents, queue.ringTimeout);
      break;

    case 'RANDOM':
      await ringRandom(callControlId, agents, queue.ringTimeout);
      break;

    case 'LEAST_RECENT':
      await ringLeastRecent(callControlId, agents, queue.ringTimeout);
      break;

    default:
      await ringAll(callControlId, agents, queue.ringTimeout);
  }
}

/**
 * RING_ALL: Dial all agents simultaneously, first to answer wins.
 */
async function ringAll(
  callControlId: string,
  agents: Array<{ user: { sipExtensions: Array<{ sipUsername: string }> } }>,
  _timeout: number
): Promise<void> {
  // Use Telnyx transfer to create a ring group
  // Transfer the call to the first available agent's SIP address
  const sipAddresses = agents.flatMap(a =>
    a.user.sipExtensions.map(e => `sip:${e.sipUsername}@sip.telnyx.com`)
  );

  if (sipAddresses.length > 0) {
    // Transfer to first agent — for true ring-all, we'd need
    // to dial multiple legs and bridge the first answer (Phase 3)
    await telnyx.transferCall(callControlId, sipAddresses[0]);
    logger.info('[Queue] Ring-all initiated', {
      callControlId,
      agents: sipAddresses.length,
    });
  }
}

/**
 * ROUND_ROBIN: Ring agents in sequence, rotating the start position.
 */
async function ringRoundRobin(
  callControlId: string,
  agents: Array<{ user: { sipExtensions: Array<{ sipUsername: string }> } }>,
  queue: { id: string; ringTimeout: number }
): Promise<void> {
  const state = queuedCalls.get(callControlId);
  if (!state) return;

  const idx = state.currentAgentIndex % agents.length;
  const agent = agents[idx];
  const ext = agent.user.sipExtensions[0];

  if (ext) {
    await telnyx.transferCall(callControlId, `sip:${ext.sipUsername}@sip.telnyx.com`);
    lastAgentPerQueue.set(queue.id, idx + 1);
    logger.info('[Queue] Round-robin ring', { callControlId, agentIndex: idx });
  }
}

/**
 * HUNT: Ring agents sequentially by priority order.
 */
async function ringHunt(
  callControlId: string,
  agents: Array<{ user: { sipExtensions: Array<{ sipUsername: string }> } }>,
  _timeout: number
): Promise<void> {
  const state = queuedCalls.get(callControlId);
  if (!state) return;

  const idx = Math.min(state.ringAttempts, agents.length - 1);
  const agent = agents[idx];
  const ext = agent.user.sipExtensions[0];

  if (ext) {
    await telnyx.transferCall(callControlId, `sip:${ext.sipUsername}@sip.telnyx.com`);
    state.ringAttempts++;
    logger.info('[Queue] Hunt ring', { callControlId, agentIndex: idx });
  }
}

/**
 * RANDOM: Ring a random available agent.
 */
async function ringRandom(
  callControlId: string,
  agents: Array<{ user: { sipExtensions: Array<{ sipUsername: string }> } }>,
  _timeout: number
): Promise<void> {
  const idx = Math.floor(Math.random() * agents.length);
  const agent = agents[idx];
  const ext = agent.user.sipExtensions[0];

  if (ext) {
    await telnyx.transferCall(callControlId, `sip:${ext.sipUsername}@sip.telnyx.com`);
    logger.info('[Queue] Random ring', { callControlId, agentIndex: idx });
  }
}

/**
 * LEAST_RECENT: Ring the agent who answered least recently.
 */
async function ringLeastRecent(
  callControlId: string,
  agents: Array<{ userId: string; user: { sipExtensions: Array<{ sipUsername: string }> } }>,
  _timeout: number
): Promise<void> {
  // Query last answered call per agent
  const agentStats = await Promise.all(
    agents.map(async (agent) => {
      const lastCall = await prisma.callLog.findFirst({
        where: {
          agentId: agent.userId,
          status: 'COMPLETED',
          direction: 'INBOUND',
        },
        orderBy: { answeredAt: 'desc' },
        select: { answeredAt: true },
      });
      return {
        agent,
        lastAnswered: lastCall?.answeredAt || new Date(0),
      };
    })
  );

  // Sort by least recent
  agentStats.sort((a, b) => a.lastAnswered.getTime() - b.lastAnswered.getTime());
  const selected = agentStats[0].agent;
  const ext = selected.user.sipExtensions[0];

  if (ext) {
    await telnyx.transferCall(callControlId, `sip:${ext.sipUsername}@sip.telnyx.com`);
    logger.info('[Queue] Least-recent ring', { callControlId, userId: selected.userId });
  }
}

/**
 * Announce queue position to caller.
 */
async function announcePosition(callControlId: string, position: number): Promise<void> {
  if (position === 1) {
    await telnyx.speakText(callControlId,
      "Vous êtes le prochain dans la file d'attente. Un agent sera avec vous sous peu.");
  } else {
    await telnyx.speakText(callControlId,
      `Vous êtes en position ${position} dans la file d'attente. Veuillez patienter.`);
  }
}

/**
 * Handle overflow when no agents available or max wait exceeded.
 */
async function handleOverflow(
  callControlId: string,
  queue: {
    overflowAction: string;
    overflowTarget?: string | null;
  }
): Promise<void> {
  logger.info('[Queue] Overflow triggered', { callControlId, action: queue.overflowAction });

  switch (queue.overflowAction) {
    case 'voicemail': {
      const { startVoicemail } = await import('./voicemail-engine');
      const target = queue.overflowTarget || 'default';
      await startVoicemail(callControlId, target);
      break;
    }

    case 'ivr': {
      if (queue.overflowTarget) {
        const { resolveIvrMenu, playIvrMenu } = await import('./ivr-engine');
        const menu = await resolveIvrMenu({ routeToIvr: queue.overflowTarget });
        if (menu) {
          await playIvrMenu(callControlId, menu);
        }
      }
      break;
    }

    case 'extension': {
      if (queue.overflowTarget) {
        const ext = await prisma.sipExtension.findUnique({
          where: { extension: queue.overflowTarget },
        });
        if (ext) {
          await telnyx.transferCall(callControlId, `sip:${ext.sipUsername}@sip.telnyx.com`);
        }
      }
      break;
    }

    default:
      await telnyx.speakText(callControlId,
        "Tous nos agents sont occupés. Veuillez rappeler plus tard.");
      await telnyx.hangupCall(callControlId);
  }

  // Remove from queue
  queuedCalls.delete(callControlId);
}

/**
 * Remove a call from the queue (on hangup or transfer).
 */
export function removeFromQueue(callControlId: string): void {
  queuedCalls.delete(callControlId);
}

/**
 * Get current queue stats.
 */
export function getQueueStats(): {
  totalQueued: number;
  byQueue: Record<string, number>;
} {
  const byQueue: Record<string, number> = {};
  for (const call of queuedCalls.values()) {
    byQueue[call.queueId] = (byQueue[call.queueId] || 0) + 1;
  }
  return { totalQueued: queuedCalls.size, byQueue };
}

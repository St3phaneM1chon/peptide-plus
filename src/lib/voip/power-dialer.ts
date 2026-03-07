/**
 * Power Dialer Engine — Automated Outbound Calling
 *
 * State Machine per agent session:
 *   IDLE → DIALING → RINGING → AMD_CHECK → CONNECTED → WRAP_UP → IDLE
 *                        ↓           ↓
 *                     NO_ANSWER   MACHINE_DETECTED
 *                     (next)      (skip/leave msg)
 *
 * Features:
 * - Auto-dial sequential from campaign list
 * - AMD detection (Telnyx Premium mode, 97% accuracy)
 * - DNCL pre-check before each dial
 * - Configurable ring timeout and wrap-up timer
 * - Campaign scheduling (start/end time, active days)
 * - Concurrent call limiting
 * - Callback scheduling from dispositions
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import * as telnyx from '@/lib/telnyx';
import { getTelnyxConnectionId } from '@/lib/telnyx';
import { checkDncl } from './dncl';
import { VoipStateMap } from './voip-state';

export type DialerState = 'IDLE' | 'DIALING' | 'RINGING' | 'AMD_CHECK' | 'CONNECTED' | 'WRAP_UP' | 'PAUSED';

interface ActiveDialerSession {
  campaignId: string;
  agentUserId: string;
  state: DialerState;
  currentEntryId?: string;
  currentCallControlId?: string;
  wrapUpTimer?: ReturnType<typeof setTimeout>;
  startedAt: Date;
  callCount: number;
  connectCount: number;
}

// Active dialer sessions per agent — Redis-backed
const activeSessions = new VoipStateMap<ActiveDialerSession>('voip:dialer:');

/**
 * Start a power dialer session for an agent on a campaign.
 */
export async function startDialerSession(
  campaignId: string,
  agentUserId: string
): Promise<{ status: string; message: string }> {
  // Check campaign exists and is active
  const campaign = await prisma.dialerCampaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    return { status: 'error', message: 'Campaign not found' };
  }

  if (campaign.status !== 'ACTIVE') {
    return { status: 'error', message: `Campaign is ${campaign.status}, must be ACTIVE` };
  }

  // Check schedule
  if (!isWithinSchedule(campaign)) {
    return { status: 'error', message: 'Outside campaign schedule hours' };
  }

  // Check concurrent sessions for this campaign
  const activeCampaignSessions = [...activeSessions.values()]
    .filter(s => s.campaignId === campaignId);
  if (activeCampaignSessions.length >= campaign.maxConcurrent) {
    return { status: 'error', message: 'Max concurrent sessions reached' };
  }

  // Create session
  const session: ActiveDialerSession = {
    campaignId,
    agentUserId,
    state: 'IDLE',
    startedAt: new Date(),
    callCount: 0,
    connectCount: 0,
  };

  activeSessions.set(agentUserId, session);

  logger.info('[Dialer] Session started', { campaignId, agentUserId });

  // Start dialing
  await dialNextContact(agentUserId);

  return { status: 'ok', message: 'Dialer session started' };
}

/**
 * Dial the next contact in the campaign list.
 * Uses iterative loop instead of recursion to avoid stack overflow with large DNCL lists.
 */
async function dialNextContact(agentUserId: string): Promise<void> {
  // Iterative loop — replaces recursive calls for DNCL skips
  const session = activeSessions.get(agentUserId);
  if (!session || session.state === 'PAUSED') return;

  // Fetch campaign once before the loop (avoid re-fetching on each DNCL skip)
  const campaign = await prisma.dialerCampaign.findUnique({
    where: { id: session.campaignId },
  });

  if (!campaign || campaign.status !== 'ACTIVE') {
    session.state = 'IDLE';
    return;
  }

  // Check schedule once
  if (!isWithinSchedule(campaign)) {
    session.state = 'PAUSED';
    logger.info('[Dialer] Paused - outside schedule', { agentUserId });
    return;
  }

  while (true) {
    // Re-check session state (could change between iterations)
    const currentSession = activeSessions.get(agentUserId);
    if (!currentSession || currentSession.state === 'PAUSED') return;

    // Get next uncalled, non-DNCL contact
    // Priority: scheduled callbacks first, then uncalled contacts
    const nextEntry = await prisma.dialerListEntry.findFirst({
      where: {
        campaignId: currentSession.campaignId,
        isCalled: false,
        isDncl: false,
        OR: [
          { scheduledAt: null },
          { scheduledAt: { lte: new Date() } },
        ],
      },
      orderBy: [
        { scheduledAt: 'asc' }, // Callbacks first
        { createdAt: 'asc' },  // Then by import order
      ],
    });

    if (!nextEntry) {
      // No more contacts — campaign done
      currentSession.state = 'IDLE';
      await prisma.dialerCampaign.update({
        where: { id: currentSession.campaignId },
        data: { status: 'COMPLETED' },
      });
      logger.info('[Dialer] Campaign completed - no more contacts', {
        campaignId: currentSession.campaignId,
      });
      return;
    }

    // DNCL check
    const isDncl = await checkDncl(nextEntry.phoneNumber);
    if (isDncl) {
      await prisma.dialerListEntry.update({
        where: { id: nextEntry.id },
        data: { isDncl: true, dnclCheckedAt: new Date() },
      });
      logger.info('[Dialer] Skipped DNCL number', { phone: nextEntry.phoneNumber });
      continue; // Try next contact (iterative, no recursion)
    }

    // Mark DNCL checked
    await prisma.dialerListEntry.update({
      where: { id: nextEntry.id },
      data: { dnclCheckedAt: new Date() },
    });

    // Dial
    session.state = 'DIALING';
    session.currentEntryId = nextEntry.id;

    const connectionId = getTelnyxConnectionId();
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/voip/webhooks/telnyx`;

    try {
      const result = await telnyx.dialCall({
        to: nextEntry.phoneNumber,
        from: campaign.callerIdNumber,
        connectionId,
        webhookUrl,
        clientState: JSON.stringify({
          campaignId: session.campaignId,
          listEntryId: nextEntry.id,
          agentUserId,
          dialer: true,
        }),
        timeout: 30,
      });

      const callControlId = (result as { data?: { call_control_id?: string } })
        ?.data?.call_control_id;

      if (callControlId) {
        session.currentCallControlId = callControlId;
        session.state = 'RINGING';
      }

      session.callCount++;

      // Update list entry
      await prisma.dialerListEntry.update({
        where: { id: nextEntry.id },
        data: {
          isCalled: true,
          callAttempts: { increment: 1 },
          lastCalledAt: new Date(),
        },
      });

      // Update campaign stats
      await prisma.dialerCampaign.update({
        where: { id: session.campaignId },
        data: { totalCalled: { increment: 1 } },
      });

      logger.info('[Dialer] Dialing', {
        phone: nextEntry.phoneNumber,
        entryId: nextEntry.id,
        callControlId,
      });
      return; // Successfully dialed — exit loop
    } catch (error) {
      logger.error('[Dialer] Dial failed', {
        phone: nextEntry.phoneNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      session.state = 'IDLE';
      // Try next after short delay
      setTimeout(() => dialNextContact(agentUserId), 2000);
      return; // Exit loop — setTimeout will re-enter
    }
  }
}

/**
 * Handle AMD result for a dialer call.
 */
export async function handleDialerAmd(
  agentUserId: string,
  amdResult: string
): Promise<void> {
  const session = activeSessions.get(agentUserId);
  if (!session) return;

  if (amdResult === 'machine') {
    session.state = 'IDLE';
    logger.info('[Dialer] AMD: machine detected, skipping', { agentUserId });
    // Auto-dial next
    await dialNextContact(agentUserId);
  } else {
    session.state = 'CONNECTED';
    session.connectCount++;
    logger.info('[Dialer] AMD: human detected, connected', { agentUserId });

    // Update campaign stats
    await prisma.dialerCampaign.update({
      where: { id: session.campaignId },
      data: { totalConnected: { increment: 1 } },
    });
  }
}

/**
 * Handle call hangup for dialer session — start wrap-up timer.
 */
export async function handleDialerHangup(agentUserId: string): Promise<void> {
  const session = activeSessions.get(agentUserId);
  if (!session) return;

  session.state = 'WRAP_UP';
  session.currentCallControlId = undefined;

  const wrapUpTime = 15; // seconds, could come from campaign config

  logger.info('[Dialer] Wrap-up started', { agentUserId, wrapUpTime });

  // Auto-advance after wrap-up timer
  session.wrapUpTimer = setTimeout(async () => {
    const s = activeSessions.get(agentUserId);
    if (s && s.state === 'WRAP_UP') {
      s.state = 'IDLE';
      await dialNextContact(agentUserId);
    }
  }, wrapUpTime * 1000);
}

/**
 * Submit disposition for the current call and move to next.
 */
export async function submitDisposition(
  agentUserId: string,
  disposition: {
    type: string;
    notes?: string;
    callbackAt?: string;
  }
): Promise<{ status: string }> {
  const session = activeSessions.get(agentUserId);
  if (!session || !session.currentEntryId) {
    return { status: 'no_active_call' };
  }

  // Clear wrap-up timer
  if (session.wrapUpTimer) {
    clearTimeout(session.wrapUpTimer);
  }

  // Create disposition record
  await prisma.dialerDisposition.create({
    data: {
      campaignId: session.campaignId,
      listEntryId: session.currentEntryId,
      type: disposition.type as never,
      notes: disposition.notes,
      callbackAt: disposition.callbackAt ? new Date(disposition.callbackAt) : undefined,
    },
  });

  // If callback requested, schedule the entry
  if (disposition.type === 'CALLBACK' && disposition.callbackAt) {
    await prisma.dialerListEntry.update({
      where: { id: session.currentEntryId },
      data: {
        isCalled: false, // Re-enable for callback
        scheduledAt: new Date(disposition.callbackAt),
      },
    });
  }

  // If customer requests DNC, add to internal DNCL
  if (disposition.type === 'DO_NOT_CALL') {
    const entry = await prisma.dialerListEntry.findUnique({
      where: { id: session.currentEntryId },
    });
    if (entry) {
      await prisma.dnclEntry.upsert({
        where: { phoneNumber: entry.phoneNumber },
        update: { source: 'customer_request', reason: disposition.notes },
        create: {
          phoneNumber: entry.phoneNumber,
          source: 'customer_request',
          reason: disposition.notes || 'Customer requested removal',
        },
      });
    }
  }

  logger.info('[Dialer] Disposition submitted', {
    agentUserId,
    entryId: session.currentEntryId,
    type: disposition.type,
  });

  // Reset and dial next
  session.currentEntryId = undefined;
  session.state = 'IDLE';
  await dialNextContact(agentUserId);

  return { status: 'ok' };
}

/**
 * Pause the dialer session.
 */
export function pauseSession(agentUserId: string): void {
  const session = activeSessions.get(agentUserId);
  if (session) {
    session.state = 'PAUSED';
    if (session.wrapUpTimer) clearTimeout(session.wrapUpTimer);
    logger.info('[Dialer] Session paused', { agentUserId });
  }
}

/**
 * Resume the dialer session.
 */
export async function resumeSession(agentUserId: string): Promise<void> {
  const session = activeSessions.get(agentUserId);
  if (session && session.state === 'PAUSED') {
    session.state = 'IDLE';
    await dialNextContact(agentUserId);
    logger.info('[Dialer] Session resumed', { agentUserId });
  }
}

/**
 * Stop the dialer session completely.
 */
export async function stopSession(agentUserId: string): Promise<void> {
  const session = activeSessions.get(agentUserId);
  if (!session) return;

  // Hang up current call if active
  if (session.currentCallControlId) {
    await telnyx.hangupCall(session.currentCallControlId).catch(() => {});
  }

  if (session.wrapUpTimer) clearTimeout(session.wrapUpTimer);
  activeSessions.delete(agentUserId);
  logger.info('[Dialer] Session stopped', {
    agentUserId,
    callCount: session.callCount,
    connectCount: session.connectCount,
  });
}

/**
 * Get the current state of a dialer session.
 */
export function getSessionState(agentUserId: string): ActiveDialerSession | null {
  return activeSessions.get(agentUserId) || null;
}

/**
 * Get all active dialer sessions.
 */
export function getAllSessions(): Array<{
  agentUserId: string;
  campaignId: string;
  state: DialerState;
  callCount: number;
  connectCount: number;
}> {
  return [...activeSessions.entries()].map(([agentUserId, s]) => ({
    agentUserId,
    campaignId: s.campaignId,
    state: s.state,
    callCount: s.callCount,
    connectCount: s.connectCount,
  }));
}

// ── Helpers ──────────────────

function isWithinSchedule(campaign: {
  startTime?: string | null;
  endTime?: string | null;
  activeDays: string[];
  timezone: string;
}): boolean {
  if (!campaign.startTime || !campaign.endTime) return true;

  // Use Intl.DateTimeFormat to get current time in campaign's timezone
  const now = new Date();
  const tz = campaign.timezone || 'America/New_York';

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const weekday = (parts.find(p => p.type === 'weekday')?.value || '').toLowerCase().slice(0, 3);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

  if (campaign.activeDays.length > 0 && !campaign.activeDays.includes(weekday)) {
    return false;
  }

  const [startH, startM] = campaign.startTime.split(':').map(Number);
  const [endH, endM] = campaign.endTime.split(':').map(Number);
  const currentMinutes = hour * 60 + minute;

  return currentMinutes >= startH * 60 + startM && currentMinutes < endH * 60 + endM;
}

/**
 * Transfer & Conference Engine
 *
 * Features:
 * - Blind transfer (immediate redirect)
 * - Attended transfer (consult, then bridge)
 * - Conference (3+ participants)
 * - Call parking (hold on virtual extension)
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import * as telnyx from '@/lib/telnyx';

// Track attended transfer state
interface AttendedTransferState {
  originalCallControlId: string;
  consultCallControlId?: string;
  targetNumber: string;
  status: 'consulting' | 'bridging' | 'cancelled';
}

const attendedTransfers = new Map<string, AttendedTransferState>();

// Track active conferences
interface ConferenceState {
  conferenceId: string;
  name: string;
  participants: Set<string>; // callControlIds
  createdAt: Date;
}

const activeConferences = new Map<string, ConferenceState>();

// ── Blind Transfer ──────────────────

/**
 * Blind transfer: immediately redirect the call to another destination.
 * Destination can be a SIP extension, phone number (E.164), or SIP URI.
 */
export async function blindTransfer(
  callControlId: string,
  destination: string,
  options?: { from?: string; fromDisplayName?: string }
): Promise<void> {
  const resolvedDest = await resolveDestination(destination);

  await telnyx.transferCall(callControlId, resolvedDest, {
    from: options?.from,
    fromDisplayName: options?.fromDisplayName,
  });

  logger.info('[Transfer] Blind transfer initiated', {
    callControlId,
    destination: resolvedDest,
  });

  // Update call log
  await updateCallLogTransfer(callControlId, 'blind', destination);
}

// ── Attended Transfer ──────────────────

/**
 * Step 1: Put original call on hold and dial the target for consultation.
 */
export async function startAttendedTransfer(
  callControlId: string,
  targetNumber: string,
  options?: {
    from?: string;
    connectionId?: string;
    webhookUrl?: string;
  }
): Promise<void> {
  // Put the original call on hold
  await telnyx.speakText(callControlId,
    "Veuillez patienter pendant le transfert.");

  // Dial the target for consultation
  const connectionId = options?.connectionId || process.env.TELNYX_CONNECTION_ID || '';
  const resolvedDest = await resolveDestination(targetNumber);

  const result = await telnyx.dialCall({
    to: resolvedDest,
    from: options?.from || process.env.TELNYX_DEFAULT_CALLER_ID || '',
    connectionId,
    webhookUrl: options?.webhookUrl,
    clientState: JSON.stringify({
      attendedTransfer: true,
      originalCallControlId: callControlId,
    }),
    timeout: 30,
  });

  const consultCallControlId = (result as { data?: { call_control_id?: string } })
    ?.data?.call_control_id;

  if (consultCallControlId) {
    attendedTransfers.set(callControlId, {
      originalCallControlId: callControlId,
      consultCallControlId,
      targetNumber,
      status: 'consulting',
    });

    logger.info('[Transfer] Attended transfer consultation started', {
      originalCall: callControlId,
      consultCall: consultCallControlId,
      target: targetNumber,
    });
  }
}

/**
 * Step 2: Complete the attended transfer by bridging the two calls.
 * Called after the consulting agent confirms.
 */
export async function completeAttendedTransfer(
  callControlId: string
): Promise<void> {
  const transfer = attendedTransfers.get(callControlId);
  if (!transfer || !transfer.consultCallControlId) {
    logger.warn('[Transfer] No attended transfer found', { callControlId });
    return;
  }

  // Bridge the original caller with the consult target
  await telnyx.bridgeCall(transfer.originalCallControlId, transfer.consultCallControlId);

  transfer.status = 'bridging';

  logger.info('[Transfer] Attended transfer completed (bridge)', {
    originalCall: transfer.originalCallControlId,
    consultCall: transfer.consultCallControlId,
  });

  await updateCallLogTransfer(callControlId, 'attended', transfer.targetNumber);

  // Cleanup
  attendedTransfers.delete(callControlId);
}

/**
 * Cancel attended transfer - return to original caller.
 */
export async function cancelAttendedTransfer(
  callControlId: string
): Promise<void> {
  const transfer = attendedTransfers.get(callControlId);
  if (!transfer) return;

  // Hang up the consult call
  if (transfer.consultCallControlId) {
    await telnyx.hangupCall(transfer.consultCallControlId);
  }

  // Resume original call
  await telnyx.speakText(transfer.originalCallControlId,
    "Le transfert a été annulé. Vous êtes de retour en ligne.");

  transfer.status = 'cancelled';
  attendedTransfers.delete(callControlId);

  logger.info('[Transfer] Attended transfer cancelled', { callControlId });
}

// ── Conference ──────────────────

/**
 * Create a conference and add the initiating call.
 */
export async function createConference(
  callControlId: string,
  conferenceName: string
): Promise<string> {
  // Use Telnyx Conference API
  const result = await telnyx.telnyxFetch<{
    id: string;
    name: string;
  }>('/conferences', {
    method: 'POST',
    body: {
      call_control_id: callControlId,
      name: conferenceName,
      beep_enabled: 'onEnterAndExit',
      start_conference_on_create: true,
    },
  });

  const conferenceId = result.data.id;

  activeConferences.set(conferenceId, {
    conferenceId,
    name: conferenceName,
    participants: new Set([callControlId]),
    createdAt: new Date(),
  });

  logger.info('[Conference] Created', {
    conferenceId,
    name: conferenceName,
    initiator: callControlId,
  });

  return conferenceId;
}

/**
 * Add a participant to an existing conference.
 */
export async function addToConference(
  conferenceId: string,
  callControlId: string,
  options?: { muted?: boolean; hold?: boolean }
): Promise<void> {
  await telnyx.telnyxFetch(`/conferences/${conferenceId}/actions/join`, {
    method: 'POST',
    body: {
      call_control_id: callControlId,
      mute: options?.muted || false,
      hold: options?.hold || false,
    },
  });

  const conf = activeConferences.get(conferenceId);
  if (conf) {
    conf.participants.add(callControlId);
  }

  logger.info('[Conference] Participant added', {
    conferenceId,
    callControlId,
    participants: conf?.participants.size,
  });
}

/**
 * Dial an external number and add to conference.
 */
export async function dialIntoConference(
  conferenceId: string,
  phoneNumber: string,
  options?: {
    from?: string;
    connectionId?: string;
  }
): Promise<void> {
  await telnyx.telnyxFetch(`/conferences/${conferenceId}/actions/dial_participant`, {
    method: 'POST',
    body: {
      to: phoneNumber,
      from: options?.from || process.env.TELNYX_DEFAULT_CALLER_ID,
      call_control_id: conferenceId,
    },
  });

  logger.info('[Conference] Dialing external participant', {
    conferenceId,
    phoneNumber,
  });
}

/**
 * Mute/unmute a conference participant.
 */
export async function muteParticipant(
  conferenceId: string,
  callControlId: string,
  mute: boolean
): Promise<void> {
  const action = mute ? 'mute' : 'unmute';
  await telnyx.telnyxFetch(`/conferences/${conferenceId}/actions/${action}`, {
    method: 'POST',
    body: {
      call_control_ids: [callControlId],
    },
  });
}

/**
 * Remove a participant from conference.
 */
export async function removeFromConference(
  conferenceId: string,
  callControlId: string
): Promise<void> {
  await telnyx.telnyxFetch(`/conferences/${conferenceId}/actions/leave`, {
    method: 'POST',
    body: {
      call_control_id: callControlId,
    },
  });

  const conf = activeConferences.get(conferenceId);
  if (conf) {
    conf.participants.delete(callControlId);
    if (conf.participants.size === 0) {
      activeConferences.delete(conferenceId);
    }
  }
}

/**
 * End entire conference.
 */
export async function endConference(conferenceId: string): Promise<void> {
  // Hang up all participants
  const conf = activeConferences.get(conferenceId);
  if (conf) {
    for (const callId of conf.participants) {
      await telnyx.hangupCall(callId).catch(() => {});
    }
  }

  activeConferences.delete(conferenceId);
  logger.info('[Conference] Ended', { conferenceId });
}

// ── Helpers ──────────────────

/**
 * Resolve a destination string to a dialable address.
 * Accepts: extension number, E.164 phone, SIP URI.
 */
async function resolveDestination(destination: string): Promise<string> {
  // Already a SIP URI
  if (destination.startsWith('sip:')) return destination;

  // E.164 phone number
  if (destination.startsWith('+')) return destination;

  // Try extension lookup
  const ext = await prisma.sipExtension.findUnique({
    where: { extension: destination },
  });

  if (ext) {
    return `sip:${ext.sipUsername}@sip.telnyx.com`;
  }

  // Assume it's a phone number, add +1 for North America
  if (/^\d{10}$/.test(destination)) {
    return `+1${destination}`;
  }

  return destination;
}

/**
 * Update call log with transfer info.
 */
async function updateCallLogTransfer(
  callControlId: string,
  type: 'blind' | 'attended',
  destination: string
): Promise<void> {
  const callLog = await prisma.callLog.findFirst({
    where: { pbxUuid: callControlId },
  });

  if (callLog) {
    await prisma.callLog.update({
      where: { id: callLog.id },
      data: {
        status: 'TRANSFERRED',
        disposition: `transfer_${type}`,
        agentNotes: `Transferred (${type}) to ${destination}`,
      },
    });
  }
}

/**
 * Cleanup transfer/conference state on call hangup.
 */
export function cleanupTransferState(callControlId: string): void {
  attendedTransfers.delete(callControlId);

  // Remove from any conference
  for (const [confId, conf] of activeConferences) {
    if (conf.participants.has(callControlId)) {
      conf.participants.delete(callControlId);
      if (conf.participants.size === 0) {
        activeConferences.delete(confId);
      }
    }
  }
}

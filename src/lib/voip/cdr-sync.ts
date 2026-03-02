/**
 * CDR (Call Detail Record) Sync Service
 * Receives CDR data from FreeSWITCH mod_json_cdr webhook and stores in DB.
 * Maps caller numbers to existing clients via User.phone field.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { CallDirection, CallStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types - FreeSWITCH mod_json_cdr payload
// ---------------------------------------------------------------------------

export interface FreeSwitchCdr {
  core_uuid?: string;
  switchname?: string;
  channel_data?: {
    state?: string;
    direction?: string;
  };
  variables?: {
    uuid?: string;
    call_uuid?: string;
    direction?: string;
    caller_id_number?: string;
    caller_id_name?: string;
    destination_number?: string;
    effective_caller_id_number?: string;
    effective_caller_id_name?: string;
    start_stamp?: string;
    answer_stamp?: string;
    end_stamp?: string;
    duration?: string;
    billsec?: string;
    hangup_cause?: string;
    cc_queue?: string;
    last_sent_callee_id_name?: string;
    waitsec?: string;
    sip_from_user?: string;
    sip_to_user?: string;
    record_file_name?: string;
    record_path?: string;
  };
  callflow?: Array<{
    caller_profile?: {
      caller_id_number?: string;
      caller_id_name?: string;
      destination_number?: string;
    };
  }>;
}

// ---------------------------------------------------------------------------
// CDR Processing
// ---------------------------------------------------------------------------

/**
 * Ingest a CDR from FreeSWITCH mod_json_cdr webhook.
 * Creates a CallLog entry and attempts to link to existing client.
 */
export async function ingestCdr(cdr: FreeSwitchCdr): Promise<string | null> {
  try {
    const vars = cdr.variables || {};
    const pbxUuid = vars.uuid || vars.call_uuid || cdr.core_uuid;

    if (!pbxUuid) {
      logger.warn('[CDR] No UUID in CDR payload');
      return null;
    }

    // Skip if already ingested
    const existing = await prisma.callLog.findUnique({
      where: { pbxUuid },
      select: { id: true },
    });
    if (existing) {
      logger.debug(`[CDR] Duplicate UUID ${pbxUuid}, skipping`);
      return existing.id;
    }

    // Parse direction
    const rawDirection = vars.direction || cdr.channel_data?.direction || 'inbound';
    const direction = mapDirection(rawDirection);

    // Parse caller/called numbers
    const callerNumber = normalizePhoneNumber(
      vars.effective_caller_id_number || vars.caller_id_number || ''
    );
    const calledNumber = normalizePhoneNumber(
      vars.destination_number || ''
    );
    const callerName = vars.effective_caller_id_name || vars.caller_id_name || null;

    // Parse timestamps
    const startedAt = vars.start_stamp ? new Date(vars.start_stamp) : new Date();
    const answeredAt = vars.answer_stamp ? new Date(vars.answer_stamp) : null;
    const endedAt = vars.end_stamp ? new Date(vars.end_stamp) : null;

    // Parse durations
    const duration = vars.duration ? parseInt(vars.duration, 10) : null;
    const billableSec = vars.billsec ? parseInt(vars.billsec, 10) : null;
    const waitTime = vars.waitsec ? parseInt(vars.waitsec, 10) : null;

    // Determine status
    const status = mapCallStatus(vars.hangup_cause, billableSec);

    // Try to match caller to a client
    const clientId = callerNumber
      ? await lookupClientByPhone(callerNumber)
      : null;

    // Try to match agent extension
    const agentId = await lookupAgentByExtension(
      direction === 'INBOUND' ? vars.sip_to_user : vars.sip_from_user
    );

    // Try to match phone number (DID)
    const didNumber = direction === 'INBOUND' ? calledNumber : callerNumber;
    const phoneNumberId = didNumber
      ? await lookupPhoneNumber(didNumber)
      : null;

    // Find connection (first enabled)
    const connection = await prisma.voipConnection.findFirst({
      where: { isEnabled: true },
      select: { id: true },
    });

    const callLog = await prisma.callLog.create({
      data: {
        pbxUuid,
        connectionId: connection?.id || null,
        callerNumber: callerNumber || 'unknown',
        callerName,
        calledNumber: calledNumber || 'unknown',
        direction,
        phoneNumberId,
        agentId,
        queue: vars.cc_queue || null,
        startedAt,
        answeredAt,
        endedAt,
        duration,
        billableSec,
        waitTime,
        status,
        hangupCause: vars.hangup_cause || null,
        clientId,
      },
    });

    // If recording exists, create a CallRecording entry
    if (vars.record_path || vars.record_file_name) {
      const localPath = vars.record_path
        ? `${vars.record_path}/${vars.record_file_name || ''}`
        : vars.record_file_name || null;

      await prisma.callRecording.create({
        data: {
          callLogId: callLog.id,
          localPath,
          durationSec: duration,
          format: 'wav',
        },
      });
    }

    logger.info(`[CDR] Ingested call ${pbxUuid} → ${callLog.id}`, {
      direction,
      callerNumber,
      calledNumber,
      duration,
      status,
      clientId,
    });

    return callLog.id;
  } catch (error) {
    logger.error('[CDR] Failed to ingest CDR', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Client Lookup
// ---------------------------------------------------------------------------

/**
 * Lookup a client by phone number. Matches User.phone field.
 */
async function lookupClientByPhone(phone: string): Promise<string | null> {
  if (!phone || phone.length < 7) return null;

  // Try exact match first
  const user = await prisma.user.findFirst({
    where: {
      phone: { contains: phone.replace(/^\+/, '') },
    },
    select: { id: true },
  });

  return user?.id || null;
}

/**
 * Lookup an agent's SipExtension by extension number.
 */
async function lookupAgentByExtension(
  extension?: string | null
): Promise<string | null> {
  if (!extension) return null;

  const ext = await prisma.sipExtension.findUnique({
    where: { extension },
    select: { id: true },
  });

  return ext?.id || null;
}

/**
 * Lookup a PhoneNumber record by number.
 */
async function lookupPhoneNumber(number: string): Promise<string | null> {
  if (!number) return null;

  const phone = await prisma.phoneNumber.findFirst({
    where: {
      OR: [
        { number },
        { number: `+${number.replace(/^\+/, '')}` },
      ],
    },
    select: { id: true },
  });

  return phone?.id || null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapDirection(raw: string): CallDirection {
  switch (raw.toLowerCase()) {
    case 'inbound':
      return 'INBOUND';
    case 'outbound':
      return 'OUTBOUND';
    case 'internal':
    case 'local':
      return 'INTERNAL';
    default:
      return 'INBOUND';
  }
}

function mapCallStatus(
  hangupCause?: string | null,
  billableSec?: number | null
): CallStatus {
  if (!hangupCause) return 'IN_PROGRESS';

  switch (hangupCause) {
    case 'NORMAL_CLEARING':
    case 'SUCCESS':
      return billableSec && billableSec > 0 ? 'COMPLETED' : 'MISSED';
    case 'NO_ANSWER':
    case 'NO_USER_RESPONSE':
    case 'ORIGINATOR_CANCEL':
      return 'MISSED';
    case 'USER_BUSY':
    case 'CALL_REJECTED':
      return 'MISSED';
    case 'NORMAL_TEMPORARY_FAILURE':
    case 'SERVICE_UNAVAILABLE':
    case 'NETWORK_OUT_OF_ORDER':
      return 'FAILED';
    case 'ATTENDED_TRANSFER':
    case 'BLIND_TRANSFER':
      return 'TRANSFERRED';
    default:
      return billableSec && billableSec > 0 ? 'COMPLETED' : 'FAILED';
  }
}

/**
 * Normalize phone number to E.164-like format.
 */
function normalizePhoneNumber(raw: string): string {
  // Remove spaces, dashes, parens
  const cleaned = raw.replace(/[\s\-()]/g, '');

  // If it looks like an extension (4 digits), keep as-is
  if (/^\d{3,5}$/.test(cleaned)) {
    return cleaned;
  }

  // Ensure + prefix for international numbers
  if (/^\d{10,15}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  return cleaned;
}

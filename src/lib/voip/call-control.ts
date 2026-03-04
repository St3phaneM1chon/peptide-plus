/**
 * Call Control Business Logic
 *
 * Processes Telnyx webhook events and manages call lifecycle.
 * Handles: call logging, IVR routing, recording, AMD, transcription.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import * as telnyx from '@/lib/telnyx';

// Event payload shape from webhook handler
export interface CallEventPayload {
  callControlId: string;
  callLegId?: string;
  callSessionId?: string;
  connectionId?: string;
  from?: string;
  to?: string;
  direction?: 'inbound' | 'outbound';
  state?: string;
  clientState?: Record<string, unknown>;
  hangupCause?: string;
  hangupSource?: string;
  digit?: string;
  digits?: string;
  recordingUrls?: { mp3?: string; wav?: string };
  amdResult?: string;
  transcriptionData?: { text: string; confidence: number; is_final: boolean };
}

// Active call state cache (in-memory for now, Redis later)
const activeCallStates = new Map<string, {
  callLogId?: string;
  ivrMenuId?: string;
  ivrAttempts?: number;
  campaignId?: string;
  listEntryId?: string;
}>();

/**
 * Main event router - dispatches Telnyx events to handlers.
 */
export async function handleCallEvent(eventType: string, payload: CallEventPayload) {
  switch (eventType) {
    case 'call.initiated':
      return handleCallInitiated(payload);

    case 'call.answered':
      return handleCallAnswered(payload);

    case 'call.hangup':
      return handleCallHangup(payload);

    case 'call.dtmf.received':
      return handleDtmfReceived(payload);

    case 'call.gather.ended':
      return handleGatherEnded(payload);

    case 'call.recording.saved':
      return handleRecordingSaved(payload);

    case 'call.machine.detection.ended':
      return handleAmdResult(payload);

    case 'streaming.started':
    case 'call.transcription':
      return handleTranscription(payload);

    case 'call.speak.ended':
      // TTS playback completed - no action needed
      break;

    default:
      logger.debug('[CallControl] Unhandled event type', { eventType });
  }
}

// ── Event Handlers ─────────────────────────

async function handleCallInitiated(payload: CallEventPayload) {
  const { callControlId, from, to, direction, connectionId } = payload;

  // Create call log entry
  const callLog = await prisma.callLog.create({
    data: {
      pbxUuid: callControlId,
      callerNumber: from || 'unknown',
      calledNumber: to || 'unknown',
      direction: direction === 'inbound' ? 'INBOUND' : 'OUTBOUND',
      startedAt: new Date(),
      status: 'RINGING',
      ...(connectionId ? {
        connection: {
          connect: { provider: 'telnyx' },
        },
      } : {}),
    },
  });

  // Cache the call log ID for later events
  activeCallStates.set(callControlId, {
    callLogId: callLog.id,
    ...(payload.clientState as Record<string, string> || {}),
  });

  logger.info('[CallControl] Call initiated', {
    callLogId: callLog.id,
    direction,
    from,
    to,
  });

  // For inbound calls: answer and route through IVR
  if (direction === 'inbound') {
    await telnyx.answerCall(callControlId);
  }
}

async function handleCallAnswered(payload: CallEventPayload) {
  const { callControlId } = payload;
  const state = activeCallStates.get(callControlId);

  if (state?.callLogId) {
    await prisma.callLog.update({
      where: { id: state.callLogId },
      data: {
        status: 'IN_PROGRESS',
        answeredAt: new Date(),
      },
    });
  }

  // For inbound calls: play IVR greeting or route to agent
  if (payload.direction === 'inbound') {
    await routeInboundCall(callControlId, payload);
  }

  // For outbound dialer calls: start AMD detection
  if (state?.campaignId) {
    await telnyx.enableAmd(callControlId);
  }

  // Start recording (with consent already announced for inbound)
  await telnyx.startRecording(callControlId, {
    channels: 'dual',
    format: 'wav',
  });
}

async function handleCallHangup(payload: CallEventPayload) {
  const { callControlId, hangupCause } = payload;
  const state = activeCallStates.get(callControlId);

  if (state?.callLogId) {
    const callLog = await prisma.callLog.findUnique({
      where: { id: state.callLogId },
    });

    const endedAt = new Date();
    const duration = callLog?.startedAt
      ? Math.round((endedAt.getTime() - callLog.startedAt.getTime()) / 1000)
      : undefined;
    const billableSec = callLog?.answeredAt
      ? Math.round((endedAt.getTime() - callLog.answeredAt.getTime()) / 1000)
      : 0;

    await prisma.callLog.update({
      where: { id: state.callLogId },
      data: {
        status: callLog?.answeredAt ? 'COMPLETED' : 'MISSED',
        endedAt,
        duration,
        billableSec,
        hangupCause,
      },
    });
  }

  // Cleanup
  activeCallStates.delete(callControlId);
}

async function handleDtmfReceived(payload: CallEventPayload) {
  // Single digit received - typically handled by gather_using_speak
  logger.debug('[CallControl] DTMF received', { digit: payload.digit });
}

async function handleGatherEnded(payload: CallEventPayload) {
  const { callControlId, digits } = payload;
  const state = activeCallStates.get(callControlId);

  if (!digits) {
    // Timeout - replay prompt or route to operator
    await telnyx.speakText(callControlId,
      "Nous n'avons pas reçu votre choix. Veuillez réessayer.");
    return;
  }

  logger.info('[CallControl] IVR input received', { digits, callControlId });

  // Look up IVR menu option
  if (state?.ivrMenuId) {
    const option = await prisma.ivrMenuOption.findUnique({
      where: {
        menuId_digit: {
          menuId: state.ivrMenuId,
          digit: digits,
        },
      },
    });

    if (option) {
      await executeIvrAction(callControlId, option.action, option.target, option.announcement);
    } else {
      // Invalid input
      const attempts = (state.ivrAttempts || 0) + 1;
      activeCallStates.set(callControlId, { ...state, ivrAttempts: attempts });

      if (attempts >= 3) {
        // Route to operator after max retries
        await telnyx.speakText(callControlId,
          "Transfert vers un agent. Veuillez patienter.");
      } else {
        await telnyx.speakText(callControlId,
          "Choix invalide. Veuillez réessayer.");
      }
    }
  }
}

async function handleRecordingSaved(payload: CallEventPayload) {
  const { callControlId, recordingUrls } = payload;
  const state = activeCallStates.get(callControlId);

  if (state?.callLogId && recordingUrls) {
    await prisma.callRecording.create({
      data: {
        callLogId: state.callLogId,
        blobUrl: recordingUrls.wav || recordingUrls.mp3,
        format: recordingUrls.wav ? 'wav' : 'mp3',
        isUploaded: true,
        consentObtained: true,
        consentMethod: 'ivr_prompt',
      },
    });

    logger.info('[CallControl] Recording saved', {
      callLogId: state.callLogId,
      url: recordingUrls.wav || recordingUrls.mp3,
    });
  }
}

async function handleAmdResult(payload: CallEventPayload) {
  const { callControlId, amdResult } = payload;
  const state = activeCallStates.get(callControlId);

  logger.info('[CallControl] AMD result', { result: amdResult, callControlId });

  if (amdResult === 'machine' && state?.campaignId) {
    // Answering machine detected during dialer campaign - hang up
    await telnyx.hangupCall(callControlId);

    if (state.callLogId) {
      await prisma.callLog.update({
        where: { id: state.callLogId },
        data: {
          status: 'COMPLETED',
          disposition: 'voicemail_detected',
          tags: ['amd_machine'],
        },
      });
    }
  }
  // If human detected, continue with the call normally
}

async function handleTranscription(payload: CallEventPayload) {
  const { callControlId, transcriptionData } = payload;
  const state = activeCallStates.get(callControlId);

  if (transcriptionData?.is_final && state?.callLogId) {
    // Append to or create transcription record
    const existing = await prisma.callTranscription.findUnique({
      where: { callLogId: state.callLogId },
    });

    if (existing) {
      await prisma.callTranscription.update({
        where: { id: existing.id },
        data: {
          fullText: existing.fullText + ' ' + transcriptionData.text,
        },
      });
    } else {
      await prisma.callTranscription.create({
        data: {
          callLogId: state.callLogId,
          fullText: transcriptionData.text,
          engine: 'telnyx',
          confidence: transcriptionData.confidence,
          language: 'fr',
        },
      });
    }
  }
}

// ── IVR Routing ─────────────────────────

async function routeInboundCall(callControlId: string, payload: CallEventPayload) {
  const { to } = payload;

  // Find which phone number was called
  const phoneNumber = to ? await prisma.phoneNumber.findUnique({
    where: { number: to },
  }) : null;

  if (!phoneNumber) {
    // Unknown number - play generic greeting
    await telnyx.speakText(callControlId,
      "Merci d'avoir appelé. Veuillez patienter pendant que nous transférons votre appel.");
    return;
  }

  // Route based on phone number configuration
  if (phoneNumber.routeToIvr) {
    // Load IVR menu and play options
    const ivrMenu = await prisma.ivrMenu.findFirst({
      where: { id: phoneNumber.routeToIvr, isActive: true },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });

    if (ivrMenu) {
      activeCallStates.set(callControlId, {
        ...activeCallStates.get(callControlId),
        ivrMenuId: ivrMenu.id,
        ivrAttempts: 0,
      });

      // Play consent notice then IVR greeting
      const greeting = ivrMenu.greetingText || buildIvrGreeting(ivrMenu.options);

      await telnyx.speakText(callControlId,
        "Cet appel peut être enregistré à des fins de qualité. " + greeting,
        { language: ivrMenu.language });

      // Gather DTMF input
      await telnyx.gatherDtmf(callControlId, {
        prompt: greeting,
        language: ivrMenu.language,
        maxDigits: 1,
        timeoutSecs: ivrMenu.inputTimeout,
      });
    }
  } else {
    // Direct routing - play consent notice then transfer
    await telnyx.speakText(callControlId,
      "Cet appel peut être enregistré à des fins de qualité. Veuillez patienter.");
  }
}

function buildIvrGreeting(options: Array<{ digit: string; label: string }>): string {
  const lines = options.map(opt => `Pour ${opt.label}, appuyez sur ${opt.digit}.`);
  return 'Bienvenue chez BioCycle. ' + lines.join(' ');
}

async function executeIvrAction(
  callControlId: string,
  action: string,
  target: string,
  announcement?: string | null
) {
  if (announcement) {
    await telnyx.speakText(callControlId, announcement);
  }

  switch (action) {
    case 'transfer_ext':
      // Transfer to a SIP extension
      await telnyx.transferCall(callControlId, `sip:${target}@sip.telnyx.com`);
      break;

    case 'transfer_queue':
      // TODO: Implement queue routing (ring agents in the queue)
      await telnyx.speakText(callControlId,
        "Transfert au département. Veuillez patienter.");
      break;

    case 'sub_menu':
      // Load sub-menu and play it
      const subMenu = await prisma.ivrMenu.findFirst({
        where: { id: target, isActive: true },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      });
      if (subMenu) {
        activeCallStates.set(callControlId, {
          ...activeCallStates.get(callControlId),
          ivrMenuId: subMenu.id,
          ivrAttempts: 0,
        });
        const greeting = subMenu.greetingText || buildIvrGreeting(subMenu.options);
        await telnyx.gatherDtmf(callControlId, {
          prompt: greeting,
          language: subMenu.language,
          maxDigits: 1,
        });
      }
      break;

    case 'voicemail':
      await telnyx.speakText(callControlId,
        "Vous êtes dirigé vers la messagerie vocale. Laissez votre message après le bip.");
      // Start recording for voicemail
      await telnyx.startRecording(callControlId, { channels: 'single', format: 'wav' });
      break;

    case 'external':
      // Transfer to an external number
      await telnyx.transferCall(callControlId, target);
      break;
  }
}

// ── Outbound Dialer ─────────────────────────

/**
 * Initiate an outbound call for a dialer campaign.
 */
export async function dialCampaignCall(options: {
  campaignId: string;
  listEntryId: string;
  phoneNumber: string;
  callerIdNumber: string;
  connectionId: string;
  webhookUrl: string;
}) {
  const clientState = JSON.stringify({
    campaignId: options.campaignId,
    listEntryId: options.listEntryId,
  });

  const result = await telnyx.dialCall({
    to: options.phoneNumber,
    from: options.callerIdNumber,
    connectionId: options.connectionId,
    webhookUrl: options.webhookUrl,
    clientState,
    timeout: 30,
  });

  // Mark the list entry as called
  await prisma.dialerListEntry.update({
    where: { id: options.listEntryId },
    data: {
      isCalled: true,
      callAttempts: { increment: 1 },
      lastCalledAt: new Date(),
    },
  });

  // Update campaign stats
  await prisma.dialerCampaign.update({
    where: { id: options.campaignId },
    data: {
      totalCalled: { increment: 1 },
    },
  });

  return result;
}

/**
 * Call Control Business Logic — Central Event Router
 *
 * Processes Telnyx webhook events and dispatches to specialized engines:
 * - IVR Engine: menu routing, DTMF handling, time-based routing
 * - Queue Engine: agent ring strategies, hold music, overflow
 * - Voicemail Engine: recording, transcription, notifications
 * - Transfer Engine: blind/attended transfer, conference
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import * as telnyx from '@/lib/telnyx';
import { sendPushToStaff } from '@/lib/apns';
import { resolveIvrMenu, playIvrMenu, handleIvrInput, handleIvrTimeout } from './ivr-engine';
import { routeToQueue, removeFromQueue } from './queue-engine';
import { handleVoicemailSaved, isVoicemailActive, cleanupVoicemail, startVoicemail } from './voicemail-engine';
import { cleanupTransferState } from './transfer-engine';
import { createPostCallActivity } from './crm-integration';
import { VoipStateMap } from './voip-state';
import type { AgentAssist } from './agent-assist';
import type { ConversationalIVR } from './conversational-ivr';
import { LiveCallScorer, saveScorecard } from './live-scoring';
import { LiveSentimentAnalyzer, saveSentiment } from './live-sentiment';
import { executePostCallWorkflow } from './post-call-workflow';
import { FEATURE_FLAGS } from './phone-system-config';

// Active Agent Assist instances per call (for live AI suggestions)
const activeAgentAssist = new Map<string, AgentAssist>();

// Active Live Scoring instances per call (quality scorecard)
const activeScorers = new Map<string, LiveCallScorer>();

// Active Sentiment Analyzer instances per call (real-time sentiment)
const activeSentiment = new Map<string, LiveSentimentAnalyzer>();

// Active Conversational IVR instances per call (GPT-powered, stored separately
// because ConversationalIVR is a class instance that cannot be serialized into VoipStateMap)
const activeConversationalIVR = new Map<string, ConversationalIVR>();

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

// Active call state cache — Redis-backed with in-memory fallback
export const activeCallStates = new VoipStateMap<{
  callLogId?: string;
  ivrMenuId?: string;
  ivrAttempts?: number;
  campaignId?: string;
  listEntryId?: string;
  queueId?: string;
  isVoicemail?: boolean;
  callerNumber?: string;
  callerName?: string;
  language?: string; // Detected language (from dialed number or caller preference)
  dialedNumber?: string; // The number that was called (for multi-DID routing)
}>('voip:call:');

/**
 * Main event router — dispatches Telnyx events to handlers.
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

    case 'call.bridged':
      logger.info('[CallControl] Call bridged', { callControlId: payload.callControlId });
      break;

    case 'call.speak.ended':
      // TTS playback completed - no action needed
      break;

    case 'conference.participant.joined':
    case 'conference.participant.left':
      logger.info('[CallControl] Conference event', { eventType, callControlId: payload.callControlId });
      break;

    default:
      logger.debug('[CallControl] Unhandled event type', { eventType });
  }
}

// ── Event Handlers ─────────────────────────

async function handleCallInitiated(payload: CallEventPayload) {
  const { callControlId, from, to, direction } = payload;

  // ─── CRITICAL: Answer inbound calls IMMEDIATELY before any DB work ────
  // Telnyx has a short timeout (~30s). If we do DB queries first,
  // the call will timeout and hang up before we answer.
  if (direction === 'inbound') {
    try {
      await telnyx.answerCall(callControlId);
      logger.info('[CallControl] Call answered', { callControlId, from, to });
    } catch (answerError) {
      const errMsg = answerError instanceof Error ? answerError.message : String(answerError);
      logger.error('[CallControl] answerCall FAILED', { callControlId, error: errMsg });
      // Save the error to DB for debugging (fire-and-forget)
      prisma.callLog.updateMany({
        where: { pbxUuid: callControlId },
        data: { hangupCause: `answer_failed: ${errMsg.slice(0, 200)}`, status: 'MISSED' },
      }).catch(() => {});
      return;
    }
  }

  // ─── Now do DB operations (non-blocking for call flow) ────
  // Look up the phone number to get language and forwarding config
  const phoneNumber = to ? await prisma.phoneNumber.findUnique({
    where: { number: to },
  }) : null;

  // Create call log entry
  let callLog;
  try {
    callLog = await prisma.callLog.create({
      data: {
        pbxUuid: callControlId,
        callerNumber: from || 'unknown',
        calledNumber: to || 'unknown',
        direction: direction === 'inbound' ? 'INBOUND' : 'OUTBOUND',
        startedAt: new Date(),
        status: direction === 'inbound' ? 'IN_PROGRESS' : 'RINGING',
        ...(phoneNumber ? { phoneNumberId: phoneNumber.id } : {}),
      },
    });
  } catch (err) {
    logger.warn('[CallControl] CallLog create failed, trying minimal', {
      error: err instanceof Error ? err.message : String(err),
    });
    callLog = await prisma.callLog.create({
      data: {
        pbxUuid: callControlId,
        callerNumber: from || 'unknown',
        calledNumber: to || 'unknown',
        direction: direction === 'inbound' ? 'INBOUND' : 'OUTBOUND',
        startedAt: new Date(),
        status: 'RINGING',
      },
    });
  }

  // Cache the call state for later events
  activeCallStates.set(callControlId, {
    callLogId: callLog.id,
    callerNumber: from,
    callerName: undefined,
    dialedNumber: to,
    language: phoneNumber?.language || 'fr-CA',
    ...(payload.clientState as Record<string, string> || {}),
  });

  logger.info('[CallControl] Call initiated', {
    callLogId: callLog.id,
    direction,
    from,
    to,
    language: phoneNumber?.language,
    region: phoneNumber?.region,
  });

  // For inbound calls: handle forwarding or continue to routing
  // (answerCall already done above)
  if (direction === 'inbound') {
    // Handle forwarding (alias numbers like Gatineau → Montreal)
    if (phoneNumber?.forwardTo) {
      logger.info('[CallControl] Forwarding call', {
        from: to,
        forwardTo: phoneNumber.forwardTo,
      });
      await telnyx.transferCall(callControlId, phoneNumber.forwardTo, {
        from: from,
      });
      return;
    }

    // Send push notification to staff for incoming call
    sendPushToStaff({
      title: 'Appel entrant',
      body: `${from || 'Inconnu'} → ${phoneNumber?.displayName || to}`,
      category: 'CALL',
      sound: 'Appel.caf',
      data: {
        type: 'incoming_call',
        callerNumber: from || '',
        dialedNumber: to || '',
      },
    }).catch(() => { /* non-blocking */ });
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

  // For inbound calls: route through IVR/Queue/Direct
  if (payload.direction === 'inbound') {
    await routeInboundCall(callControlId, payload);
  }

  // For outbound dialer calls: start AMD detection
  if (state?.campaignId) {
    await telnyx.enableAmd(callControlId);
  }

  // Start recording (consent announced in IVR greeting)
  if (!state?.isVoicemail) {
    await telnyx.startRecording(callControlId, {
      channels: 'dual',
      format: 'wav',
    });
  }

  // Initialize live scoring and sentiment analysis for the call
  if (!state?.isVoicemail) {
    activeScorers.set(callControlId, new LiveCallScorer({ updateInterval: 30 }));
    activeSentiment.set(callControlId, new LiveSentimentAnalyzer({ minTextLength: 15 }));
  }
}

async function handleCallHangup(payload: CallEventPayload) {
  const { callControlId, hangupCause } = payload;
  const state = activeCallStates.get(callControlId);
  let isCompletedCall = false;

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

    const finalStatus = callLog?.answeredAt ? 'COMPLETED' : 'MISSED';
    isCompletedCall = finalStatus === 'COMPLETED';

    await prisma.callLog.update({
      where: { id: state.callLogId },
      data: {
        status: finalStatus,
        endedAt,
        duration,
        billableSec,
        hangupCause,
      },
    });

    // Create CRM Activity for client timeline (fire-and-forget, non-blocking)
    createPostCallActivity({
      id: state.callLogId,
      clientId: callLog?.clientId,
      agentId: callLog?.agentId,
      direction: callLog?.direction as string || 'OUTBOUND',
      duration,
      status: finalStatus,
      callerNumber: callLog?.callerNumber || 'unknown',
      calledNumber: callLog?.calledNumber || 'unknown',
      agentNotes: callLog?.agentNotes,
      disposition: callLog?.disposition,
      tags: callLog?.tags,
    }).catch(() => {}); // Fire-and-forget

    // Follow-up for missed calls without voicemail (non-blocking, fire-and-forget)
    if (finalStatus === 'MISSED' && !state.isVoicemail && callLog) {
      import('./missed-call-followup').then(({ handleMissedCallFollowup }) => {
        handleMissedCallFollowup({
          id: state.callLogId!,
          callerNumber: callLog.callerNumber,
          calledNumber: callLog.calledNumber,
          clientId: callLog.clientId,
          direction: callLog.direction,
        }).catch(() => {});
      }).catch(() => {});
    }

    // Execute post-call workflow based on disposition (non-blocking, fire-and-forget)
    if (callLog?.disposition) {
      // Resolve agent's userId from SipExtension (agentId is the SipExtension ID)
      let agentUserId: string | null = null;
      if (callLog.agentId) {
        const ext = await prisma.sipExtension.findUnique({
          where: { id: callLog.agentId },
          select: { userId: true },
        });
        agentUserId = ext?.userId || null;
      }

      executePostCallWorkflow({
        callLogId: state.callLogId,
        clientId: callLog.clientId,
        agentUserId,
        disposition: callLog.disposition,
        agentNotes: callLog.agentNotes,
        callerNumber: callLog.callerNumber || 'unknown',
        calledNumber: callLog.calledNumber || 'unknown',
        duration,
        status: finalStatus,
        tags: callLog.tags,
      }).catch(() => {}); // Fire-and-forget
    }
  }

  // Generate AI call summary for completed calls (non-blocking, fire-and-forget)
  if (state?.callLogId && isCompletedCall) {
    generateAutoSummary(state.callLogId).catch(() => {});
  }

  // Persist live scoring and sentiment analysis (non-blocking, fire-and-forget)
  if (state?.callLogId) {
    const scorer = activeScorers.get(callControlId);
    if (scorer) {
      scorer.getFinalScorecard()
        .then((scorecard) => saveScorecard(state.callLogId!, scorecard))
        .catch((err) => {
          logger.warn('[CallControl] Live scoring persistence failed', {
            callLogId: state.callLogId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }

    const sentiment = activeSentiment.get(callControlId);
    if (sentiment) {
      const overall = sentiment.getOverallSentiment();
      saveSentiment(state.callLogId, overall).catch((err) => {
        logger.warn('[CallControl] Sentiment persistence failed', {
          callLogId: state.callLogId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
  }

  // Cleanup all engine states
  removeFromQueue(callControlId);
  cleanupVoicemail(callControlId);
  cleanupTransferState(callControlId);
  activeAgentAssist.delete(callControlId);
  activeConversationalIVR.delete(callControlId);
  activeScorers.delete(callControlId);
  activeSentiment.delete(callControlId);

  // Cleanup Voice AI session (non-blocking)
  import('./voice-ai-engine').then(({ getVoiceAIEngine }) => {
    const engine = getVoiceAIEngine();
    if (engine.isSessionActive(callControlId)) {
      engine.stopSession(callControlId).catch(() => {});
    }
  }).catch(() => {});

  activeCallStates.delete(callControlId);
}

async function handleDtmfReceived(payload: CallEventPayload) {
  logger.debug('[CallControl] DTMF received', { digit: payload.digit });
}

async function handleGatherEnded(payload: CallEventPayload) {
  const { callControlId, digits } = payload;
  const state = activeCallStates.get(callControlId);

  if (!state?.ivrMenuId) return;

  // Load the menu for timeout handling
  const menu = await prisma.ivrMenu.findFirst({
    where: { id: state.ivrMenuId, isActive: true },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!digits || digits === '') {
    // Timeout — delegate to IVR engine
    const attempts = (state.ivrAttempts || 0) + 1;
    activeCallStates.set(callControlId, { ...state, ivrAttempts: attempts });

    if (menu) {
      await handleIvrTimeout(callControlId, menu, attempts);
    } else {
      const lang = state.language || 'fr-CA';
      const msg = lang.startsWith('fr')
        ? "Nous n'avons pas reçu votre choix. Transfert vers un agent."
        : "We did not receive your selection. Transferring to an agent.";
      await telnyx.speakText(callControlId, msg, { language: lang });
    }
    return;
  }

  logger.info('[CallControl] IVR input received', { digits, callControlId });

  // Delegate to IVR engine
  const handled = await handleIvrInput(callControlId, state.ivrMenuId, digits);

  if (!handled) {
    // Invalid input
    const attempts = (state.ivrAttempts || 0) + 1;
    activeCallStates.set(callControlId, { ...state, ivrAttempts: attempts });

    const lang = state.language || menu?.language || 'fr-CA';
    const isFr = lang.startsWith('fr');

    if (attempts >= (menu?.maxRetries || 3)) {
      // Max retries — route to operator or voicemail
      if (menu?.timeoutAction === 'voicemail' && menu.timeoutTarget) {
        await startVoicemail(callControlId, menu.timeoutTarget, {
          from: state.callerNumber,
          language: lang,
        });
      } else {
        await telnyx.speakText(callControlId,
          isFr ? "Transfert vers un agent. Veuillez patienter." : "Transferring to an agent. Please hold.",
          { language: lang });
      }
    } else {
      await telnyx.speakText(callControlId,
        isFr ? "Choix invalide. Veuillez réessayer." : "Invalid selection. Please try again.",
        { language: lang });
      // Replay the menu
      if (menu) {
        await playIvrMenu(callControlId, menu);
      }
    }
  }
}

async function handleRecordingSaved(payload: CallEventPayload) {
  const { callControlId, recordingUrls } = payload;
  const state = activeCallStates.get(callControlId);

  if (!recordingUrls) return;

  // Check if this is a voicemail recording
  if (isVoicemailActive(callControlId)) {
    await handleVoicemailSaved(callControlId, recordingUrls);
    return;
  }

  // Regular call recording
  if (state?.callLogId) {
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
    // Answering machine detected — hang up for campaigns
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
}

async function handleTranscription(payload: CallEventPayload) {
  const { callControlId, transcriptionData } = payload;
  const state = activeCallStates.get(callControlId);

  if (transcriptionData?.is_final && state?.callLogId) {
    // ── Voice AI: intercept speech for STT→LLM→TTS pipeline ──────────────
    try {
      const { getVoiceAIEngine } = await import('./voice-ai-engine');
      const engine = getVoiceAIEngine();

      if (engine.isSessionActive(callControlId) && transcriptionData.text.trim().length > 0) {
        // Feed the transcription to Voice AI engine (it handles LLM + TTS)
        engine.processAudio(callControlId, Buffer.from(transcriptionData.text));
        // Don't return — still save the transcript and feed other engines below
      }
    } catch {
      // Voice AI not loaded — continue with normal flow
    }
    // ── Conversational IVR: intercept speech for GPT-powered routing ────────
    const civr = activeConversationalIVR.get(callControlId);
    if (civr && transcriptionData.text.trim().length > 0) {
      try {
        const action = await civr.processInput(transcriptionData.text);
        const civrLanguage = state.language || 'fr-CA';

        switch (action.type) {
          case 'speak': {
            // GPT is asking a follow-up question — speak and continue listening
            const text = action.data.text as string;
            await telnyx.speakText(callControlId, text, { language: civrLanguage });
            break;
          }
          case 'transfer': {
            // Intent detected — transfer to the appropriate queue
            const destination = action.data.destination as string;
            const message = action.data.message as string | undefined;
            if (message) {
              await telnyx.speakText(callControlId, message, { language: civrLanguage });
            }
            activeConversationalIVR.delete(callControlId);
            await routeToQueue(callControlId, destination);
            break;
          }
          case 'voicemail': {
            // Caller wants voicemail
            const vmMessage = action.data.message as string | undefined;
            if (vmMessage) {
              await telnyx.speakText(callControlId, vmMessage, { language: civrLanguage });
            }
            activeConversationalIVR.delete(callControlId);
            await startVoicemail(callControlId, '1001', {
              from: state.callerNumber,
              language: civrLanguage,
            });
            break;
          }
          case 'collect_input': {
            // Fallback to DTMF keypad
            const prompt = action.data.text as string;
            activeConversationalIVR.delete(callControlId);
            await telnyx.gatherDtmf(callControlId, {
              prompt,
              language: civrLanguage,
              maxDigits: (action.data.maxDigits as number) || 1,
              timeoutSecs: (action.data.timeoutSecs as number) || 10,
            });
            break;
          }
          case 'hangup': {
            activeConversationalIVR.delete(callControlId);
            await telnyx.hangupCall(callControlId);
            break;
          }
          default:
            break;
        }

        logger.info('[CallControl] CIVR action executed', {
          callControlId,
          actionType: action.type,
          callerText: transcriptionData.text.substring(0, 80),
        });
      } catch (error) {
        logger.error('[CallControl] CIVR processing failed, transferring to agent', {
          callControlId,
          error: error instanceof Error ? error.message : String(error),
        });
        // On CIVR failure, transfer to default queue
        activeConversationalIVR.delete(callControlId);
        await routeToQueue(callControlId, 'stephane-queue');
      }
      // Still save the transcript below (don't return — the speech is valuable data)
    }

    // Use the language from call state (derived from PhoneNumber config), fallback to 'fr'
    const callLanguage = state.language ? state.language.split('-')[0] : 'fr';

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
          language: callLanguage,
        },
      });
    }

    // Feed live scoring engine (non-blocking)
    const scorer = activeScorers.get(callControlId);
    if (scorer) {
      scorer.feedTranscript(transcriptionData.text, 'agent').catch(() => {});
    }

    // Feed live sentiment analyzer (non-blocking)
    const sentimentAnalyzer = activeSentiment.get(callControlId);
    if (sentimentAnalyzer) {
      sentimentAnalyzer.feedText(transcriptionData.text).catch(() => {});
    }

    // Feed Agent Assist for live AI suggestions (non-blocking)
    try {
      let assist = activeAgentAssist.get(callControlId);
      if (!assist) {
        const { AgentAssist: AgentAssistClass } = await import('./agent-assist');
        assist = new AgentAssistClass();
        activeAgentAssist.set(callControlId, assist);
      }
      // Treat live transcription as customer speech (suggestions are most useful for customer utterances)
      assist.feedTranscript('customer', transcriptionData.text).then((suggestions) => {
        if (suggestions.length > 0) {
          logger.info('[CallControl] Agent Assist suggestions generated', {
            callLogId: state?.callLogId,
            count: suggestions.length,
            types: suggestions.map((s) => s.type),
          });
        }
      }).catch(() => {});
    } catch {
      // Agent Assist is non-critical — never interrupt transcription flow
    }
  }
}

// ── Post-Call Auto Summary ─────────────────────────

/**
 * Generate an AI summary of the call after hangup.
 * Waits briefly for the final transcription segments to be saved,
 * then calls generateCallSummary() and stores the result.
 * Non-blocking — errors are logged but never propagated.
 */
async function generateAutoSummary(callLogId: string): Promise<void> {
  try {
    // Wait for transcription to be fully saved (last segments may still be writing)
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const transcription = await prisma.callTranscription.findUnique({
      where: { callLogId },
      select: { id: true, fullText: true, language: true },
    });

    if (!transcription?.fullText || transcription.fullText.length < 50) return;

    const { generateCallSummary } = await import('./transcription');
    const result = await generateCallSummary(transcription.fullText, {
      language: transcription.language || 'fr',
    });

    if (!result.summary) return;

    // Save summary into the individual CallTranscription fields
    await prisma.callTranscription.update({
      where: { id: transcription.id },
      data: {
        summary: result.summary,
        sentiment: result.sentiment,
        keywords: result.keyTopics,
        actionItems: result.actionItems.length > 0
          ? JSON.stringify(result.actionItems)
          : null,
      },
    });

    logger.info('[CallControl] Auto-summary generated', {
      callLogId,
      sentiment: result.sentiment,
      topicCount: result.keyTopics.length,
      actionItemCount: result.actionItems.length,
    });
  } catch (error) {
    logger.warn('[CallControl] Auto-summary failed', {
      callLogId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── Inbound Routing ─────────────────────────

/**
 * Route an inbound call based on the dialed number's configuration.
 * Priority: VIP → Smart Route → Conversational IVR → DTMF IVR → Queue → Extension → Default
 *
 * Enhanced features:
 * - VIP priority routing: GOLD/PLATINUM/VIP clients skip IVR entirely
 * - Smart routing: returning callers reconnected to their last agent (7-day window)
 * - Conversational IVR: GPT-powered natural language routing (feature-flagged)
 * - Multi-language support (greetings in the number's language)
 * - Forwarding already handled in handleCallInitiated
 * - Simultaneous ring to all staff as fallback
 * - Voicemail fallback after ring timeout
 */
async function routeInboundCall(callControlId: string, payload: CallEventPayload) {
  const { to } = payload;
  const state = activeCallStates.get(callControlId);
  const language = state?.language || 'fr-CA';
  const isFrench = language.startsWith('fr');

  const phoneNumber = to ? await prisma.phoneNumber.findUnique({
    where: { number: to },
  }) : null;

  if (!phoneNumber) {
    // Unknown number — play bilingual greeting and route to default queue (Stéphane)
    await telnyx.speakText(callControlId,
      "Merci d'avoir appelé Attitudes VIP. Thank you for calling Attitudes VIP. " +
      "Veuillez patienter. Please hold.",
      { language: 'fr-CA' });
    await routeToQueue(callControlId, 'stephane-queue');
    return;
  }

  // ── VIP Priority Routing ──────────────────────────────────────────────────
  // Recognize VIP/PLATINUM/GOLD clients by phone number and skip IVR entirely
  if (FEATURE_FLAGS.useVipRouting) {
    const callerNumber = state?.callerNumber || payload.from || '';
    // Normalize to last 10 digits for flexible matching
    const normalizedCaller = callerNumber.replace(/^\+?1/, '').slice(-10);

    if (normalizedCaller.length >= 10) {
      try {
        const vipClient = await prisma.user.findFirst({
          where: {
            phone: { contains: normalizedCaller },
            loyaltyTier: { in: ['VIP', 'PLATINUM', 'GOLD'] },
          },
          select: { id: true, name: true, loyaltyTier: true },
        });

        if (vipClient) {
          const firstName = vipClient.name?.split(' ')[0] || '';
          const vipMsg = isFrench
            ? `Merci d'être un membre ${vipClient.loyaltyTier} d'Attitudes VIP${firstName ? `, ${firstName}` : ''}. Vous êtes transféré en priorité.`
            : `Thank you for being a ${vipClient.loyaltyTier} member of Attitudes VIP${firstName ? `, ${firstName}` : ''}. Transferring you now.`;

          await telnyx.speakText(callControlId, vipMsg, { language });
          logRecordingConsent(callControlId, 'vip_greeting').catch(() => {});

          logger.info('[CallControl] VIP routing activated', {
            callControlId,
            clientId: vipClient.id,
            tier: vipClient.loyaltyTier,
          });

          // Route directly to Stéphane (skip IVR for VIPs)
          await routeToQueue(callControlId, 'stephane-queue');
          return;
        }
      } catch (error) {
        // VIP lookup is non-critical — fall through to normal routing
        logger.warn('[CallControl] VIP lookup failed, continuing normal routing', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // ── Smart Routing: Route to last agent if recent interaction ───────────────
  // If the caller spoke with an agent in the last 7 days, try to reconnect them
  if (FEATURE_FLAGS.useSmartRouting) {
    const callerNumber = state?.callerNumber || payload.from || '';
    const normalizedCaller = callerNumber.replace(/^\+?1/, '').slice(-10);

    if (normalizedCaller.length >= 10) {
      try {
        const lastCall = await prisma.callLog.findFirst({
          where: {
            callerNumber: { contains: normalizedCaller },
            status: 'COMPLETED',
            agentId: { not: null },
            startedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { startedAt: 'desc' },
          select: {
            agentId: true,
            agent: { select: { extension: true, userId: true } },
          },
        });

        if (lastCall?.agent) {
          // Check if the agent is currently online
          const agentPresence = await prisma.presenceStatus.findFirst({
            where: {
              userId: lastCall.agent.userId,
              status: 'ONLINE',
            },
          });

          if (agentPresence) {
            // Map extension to the correct queue
            const targetQueue = lastCall.agent.extension === '1002'
              ? 'caroline-queue'
              : 'stephane-queue';

            const continuityMsg = isFrench
              ? "Nous vous mettons en communication avec votre interlocuteur habituel."
              : "Connecting you with your usual contact.";
            await telnyx.speakText(callControlId, continuityMsg, { language });
            logRecordingConsent(callControlId, 'smart_routing').catch(() => {});

            logger.info('[CallControl] Smart routing to last agent', {
              callControlId,
              extension: lastCall.agent.extension,
              targetQueue,
            });

            await routeToQueue(callControlId, targetQueue);
            return;
          }
        }
      } catch (error) {
        // Smart routing is non-critical — fall through to normal routing
        logger.warn('[CallControl] Smart routing lookup failed, continuing normal routing', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // ── Voice AI Engine (highest priority after VIP/Smart) ──────────────────────
  // Full STT→LLM→TTS pipeline with RAG knowledge base.
  // Replaces both DTMF and Conversational IVR with natural voice conversation.
  // Falls back to DTMF IVR if Voice AI is unavailable.
  if (FEATURE_FLAGS.useVoiceAI) {
    try {
      const { getVoiceAIEngine, isVoiceAIAvailable } = await import('./voice-ai-engine');

      if (isVoiceAIAvailable()) {
        const engine = getVoiceAIEngine();
        const callerNumber = state?.callerNumber || payload.from || '';

        // Start Voice AI session
        const session = await engine.startSession(
          callControlId,
          callerNumber,
          to || '',
          language
        );

        // Handle transfer requests from Voice AI
        engine.on('transfer', async (data: {
          callControlId: string;
          reason: string;
          language: string;
        }) => {
          if (data.callControlId === callControlId) {
            logger.info('[CallControl] Voice AI requesting transfer', {
              callControlId,
              reason: data.reason.substring(0, 100),
            });
            await routeToQueue(callControlId, 'stephane-queue');
          }
        });

        // Start Telnyx transcription to feed the Voice AI STT
        await telnyx.startTranscription(callControlId, {
          language: session.language.split('-')[0] || 'fr',
        });

        logRecordingConsent(callControlId, 'voiceai_greeting').catch(() => {});

        // Store the Voice AI session reference in call state
        activeCallStates.set(callControlId, {
          ...state,
          language: session.language,
        });

        logger.info('[CallControl] Voice AI activated', {
          callControlId,
          language: session.language,
          clientIdentified: !!session.clientContext,
        });
        return;
      } else if (!FEATURE_FLAGS.voiceAIFallbackToDTMF) {
        logger.warn('[CallControl] Voice AI unavailable and fallback disabled');
      }
      // Fall through to DTMF/CIVR if Voice AI not available
    } catch (error) {
      logger.warn('[CallControl] Voice AI init failed, falling back', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Fall through to DTMF IVR
    }
  }

  // Route 1a: Conversational IVR (GPT-powered, if enabled)
  // When active, replaces the DTMF-only IVR with natural language understanding.
  // Requires Telnyx Media Streaming for real-time speech-to-text — the CIVR
  // processes transcription events via handleTranscription() and speaks back.
  // Falls back to DTMF-only IVR if the feature flag is off or CIVR init fails.
  if (phoneNumber.routeToIvr && FEATURE_FLAGS.useConversationalIvr) {
    try {
      const { ConversationalIVR: CIVRClass } = await import('./conversational-ivr');
      const civr = new CIVRClass({
        language: language.startsWith('fr') ? 'fr' : 'en',
      });

      // Play the GPT greeting
      const greeting = civr.getGreeting();
      await telnyx.speakText(callControlId, greeting, { language });

      // Store CIVR instance for subsequent transcription turns
      activeConversationalIVR.set(callControlId, civr);

      // Enable streaming transcription so caller speech is captured.
      // The handleTranscription() handler will detect the active CIVR
      // and route speech text through civr.processInput() instead of
      // simply appending to the transcript.
      await telnyx.startRecording(callControlId, {
        channels: 'dual',
        format: 'wav',
      });

      logRecordingConsent(callControlId, 'civr_greeting').catch(() => {});

      logger.info('[CallControl] Conversational IVR activated', {
        callControlId,
        language,
      });
      return;
    } catch (error) {
      // CIVR init failed — fall through to standard DTMF IVR
      logger.warn('[CallControl] Conversational IVR init failed, falling back to DTMF', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Route 1: IVR Menu (DTMF-only, primary routing method)
  if (phoneNumber.routeToIvr) {
    const menu = await resolveIvrMenu(phoneNumber);
    if (menu) {
      activeCallStates.set(callControlId, {
        ...state,
        ivrMenuId: menu.id,
        ivrAttempts: 0,
        language: menu.language || language,
      });
      await playIvrMenu(callControlId, menu);
      // IVR greeting includes recording consent notice — log it (non-blocking)
      logRecordingConsent(callControlId, 'ivr_greeting').catch(() => {});
      return;
    }
  }

  // Route 2: Queue
  if (phoneNumber.routeToQueue) {
    const consentMsg = isFrench
      ? "Cet appel peut être enregistré à des fins de qualité. Veuillez patienter."
      : "This call may be recorded for quality purposes. Please hold.";
    await telnyx.speakText(callControlId, consentMsg, { language });
    // Log recording consent (PIPEDA compliance) — non-blocking
    logRecordingConsent(callControlId, 'queue_greeting').catch(() => {});
    await routeToQueue(callControlId, phoneNumber.routeToQueue);
    return;
  }

  // Route 3: Direct Extension
  if (phoneNumber.routeToExt) {
    const ext = await prisma.sipExtension.findUnique({
      where: { extension: phoneNumber.routeToExt },
    });
    if (ext) {
      const transferMsg = isFrench
        ? "Cet appel peut être enregistré à des fins de qualité. Transfert en cours."
        : "This call may be recorded for quality purposes. Transferring now.";
      await telnyx.speakText(callControlId, transferMsg, { language });
      // Log recording consent (PIPEDA compliance) — non-blocking
      logRecordingConsent(callControlId, 'extension_greeting').catch(() => {});
      await telnyx.transferCall(callControlId, `sip:${ext.sipUsername}@sip.telnyx.com`);
      return;
    }
  }

  // Default: Route to Stéphane queue as fallback
  const defaultMsg = isFrench
    ? "Cet appel peut être enregistré à des fins de qualité. Veuillez patienter pendant que nous vous mettons en communication."
    : "This call may be recorded for quality purposes. Please hold while we connect you.";
  await telnyx.speakText(callControlId, defaultMsg, { language });
  // Log recording consent (PIPEDA compliance) — non-blocking
  logRecordingConsent(callControlId, 'default_greeting').catch(() => {});
  await routeToQueue(callControlId, 'stephane-queue');
}

// ── Recording Consent Logging (PIPEDA compliance) ─────────────────────────

/**
 * Log that the recording consent notice was played to the caller.
 * Stores the consent timestamp in CallLog.metadata for PIPEDA compliance.
 * Non-blocking — errors are logged but don't interrupt the call flow.
 */
async function logRecordingConsent(callControlId: string, method: string = 'ivr_prompt'): Promise<void> {
  const state = activeCallStates.get(callControlId);
  if (!state?.callLogId) return;

  try {
    const callLog = await prisma.callLog.findUnique({
      where: { id: state.callLogId },
      select: { metadata: true },
    });

    const existingMetadata = (callLog?.metadata as Record<string, unknown>) || {};

    await prisma.callLog.update({
      where: { id: state.callLogId },
      data: {
        metadata: {
          ...existingMetadata,
          recordingConsent: true,
          consentTimestamp: new Date().toISOString(),
          consentMethod: method,
        },
      },
    });

    logger.debug('[CallControl] Recording consent logged', {
      callLogId: state.callLogId,
      method,
    });
  } catch (error) {
    // Non-critical: don't interrupt the call flow if consent logging fails
    logger.warn('[CallControl] Failed to log recording consent', {
      callLogId: state?.callLogId,
      error: error instanceof Error ? error.message : String(error),
    });
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

  await prisma.dialerListEntry.update({
    where: { id: options.listEntryId },
    data: {
      isCalled: true,
      callAttempts: { increment: 1 },
      lastCalledAt: new Date(),
    },
  });

  await prisma.dialerCampaign.update({
    where: { id: options.campaignId },
    data: {
      totalCalled: { increment: 1 },
    },
  });

  return result;
}

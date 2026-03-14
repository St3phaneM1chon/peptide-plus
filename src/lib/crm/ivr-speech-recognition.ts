/**
 * CRM IVR Speech Recognition / NLP - C11
 *
 * Natural language IVR that understands spoken input instead of DTMF keypresses.
 * Uses OpenAI for intent classification from transcribed speech (assumes audio
 * has already been transcribed by streaming-transcription.ts).
 *
 * Similar to Five9 IVA and Genesys Voice Bots: callers speak naturally and
 * the system routes them based on detected intent rather than menu numbers.
 *
 * Functions:
 * - processSpokenInput: NLP intent detection from caller speech
 * - getIvrIntents: Return configured intent definitions
 * - matchIntent: Fuzzy match spoken words to intents with confidence
 * - generateSpokenResponse: Dynamic TTS response based on intent + CRM data
 * - handleLowConfidence: Fallback for ambiguous input
 * - getSpeechIvrMetrics: Recognition accuracy and performance metrics
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Lazy OpenAI client
// ---------------------------------------------------------------------------

type OpenAIClient = import('openai').default;

let _openai: OpenAIClient | null = null;

function getOpenAI(): OpenAIClient {
  if (_openai) return _openai;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set');
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { default: OpenAI } = require('openai');
  const client: OpenAIClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  _openai = client;
  return client;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IvrIntent {
  /** Unique intent identifier */
  id: string;
  /** Human-readable intent name */
  name: string;
  /** Description of what this intent handles */
  description: string;
  /** Sample phrases that should trigger this intent */
  samplePhrases: string[];
  /** Action to take when matched: route to queue, play message, or collect data */
  action: 'route' | 'play_message' | 'collect_data' | 'transfer_agent';
  /** Target queue or agent group for routing */
  routeTarget?: string;
  /** Response template for TTS playback */
  responseTemplate?: string;
  /** Whether this intent requires authentication */
  requiresAuth: boolean;
  /** Priority for disambiguation (higher = preferred) */
  priority: number;
}

export interface IntentMatchResult {
  /** Matched intent or null */
  intent: IvrIntent | null;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  /** Raw transcript that was analyzed */
  transcript: string;
  /** Top 3 intent candidates with scores */
  candidates: Array<{ intentId: string; confidence: number }>;
  /** Whether confidence meets threshold for auto-routing */
  isHighConfidence: boolean;
}

export interface SpokenResponse {
  /** Text to be spoken via TTS */
  text: string;
  /** Language code for TTS */
  language: string;
  /** Whether to expect further input after speaking */
  expectInput: boolean;
  /** DTMF fallback options if speech fails */
  dtmfFallback?: Record<string, string>;
}

export interface SpeechIvrMetrics {
  /** Total speech inputs processed */
  totalInputs: number;
  /** Inputs that matched an intent with high confidence */
  highConfidenceMatches: number;
  /** Inputs that required fallback (low confidence) */
  fallbackCount: number;
  /** Inputs where caller used DTMF instead of speech */
  dtmfFallbackCount: number;
  /** Recognition accuracy rate (0-100) */
  recognitionAccuracyRate: number;
  /** Intent match rate (0-100) */
  intentMatchRate: number;
  /** Fallback rate (0-100) */
  fallbackRate: number;
  /** Average resolution time in seconds */
  avgResolutionTimeSec: number;
  /** Most common intents in period */
  topIntents: Array<{ intentId: string; count: number }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum confidence to auto-route without confirmation */
const HIGH_CONFIDENCE_THRESHOLD = 0.75;

/** Maximum attempts before transferring to a live agent */
const MAX_RETRY_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// In-memory session tracker for multi-turn IVR conversations
// ---------------------------------------------------------------------------

interface IvrSession {
  callId: string;
  attempts: number;
  lastIntent: string | null;
  startedAt: Date;
  resolved: boolean;
}

const ivrSessions = new Map<string, IvrSession>();

// ---------------------------------------------------------------------------
// Default intents
// ---------------------------------------------------------------------------

const DEFAULT_INTENTS: IvrIntent[] = [
  {
    id: 'billing',
    name: 'Billing & Invoices',
    description: 'Questions about invoices, payments, refunds, and account balance',
    samplePhrases: [
      'I have a question about my bill',
      'I need to pay my invoice',
      'I want a refund',
      'Check my account balance',
      'Payment issue',
    ],
    action: 'route',
    routeTarget: 'billing_queue',
    requiresAuth: true,
    priority: 5,
  },
  {
    id: 'support',
    name: 'Technical Support',
    description: 'Product issues, quality concerns, and technical questions',
    samplePhrases: [
      'I need help with my order',
      'Product quality issue',
      'Technical question about peptides',
      'Something is wrong with my product',
      'I need support',
    ],
    action: 'route',
    routeTarget: 'support_queue',
    requiresAuth: false,
    priority: 4,
  },
  {
    id: 'sales',
    name: 'Sales & New Orders',
    description: 'New purchases, product information, pricing, and bulk orders',
    samplePhrases: [
      'I want to place an order',
      'What peptides do you sell',
      'Pricing information',
      'Bulk order inquiry',
      'I want to buy something',
    ],
    action: 'route',
    routeTarget: 'sales_queue',
    requiresAuth: false,
    priority: 3,
  },
  {
    id: 'appointment',
    name: 'Schedule Appointment',
    description: 'Book a consultation or callback',
    samplePhrases: [
      'I want to schedule a call',
      'Book an appointment',
      'Can someone call me back',
      'I need a consultation',
    ],
    action: 'collect_data',
    responseTemplate: 'I can help you schedule an appointment. What day and time works best for you?',
    requiresAuth: false,
    priority: 2,
  },
  {
    id: 'order_status',
    name: 'Order Status',
    description: 'Check existing order status, tracking, and shipping',
    samplePhrases: [
      'Where is my order',
      'Track my package',
      'Shipping status',
      'When will my order arrive',
      'Order tracking',
    ],
    action: 'collect_data',
    responseTemplate: 'I can look up your order. Please provide your order number or the email address on your account.',
    requiresAuth: true,
    priority: 5,
  },
  {
    id: 'transfer_agent',
    name: 'Speak to Agent',
    description: 'Direct request to speak with a human agent',
    samplePhrases: [
      'I want to speak to a person',
      'Transfer me to an agent',
      'Human please',
      'Operator',
      'I want to talk to someone',
    ],
    action: 'transfer_agent',
    requiresAuth: false,
    priority: 10,
  },
  {
    id: 'repeat',
    name: 'Repeat Menu',
    description: 'Request to hear options again',
    samplePhrases: [
      'Repeat that',
      'Say that again',
      'What are my options',
      'Menu',
      'I did not understand',
    ],
    action: 'play_message',
    responseTemplate: 'No problem. You can say: billing, support, sales, check order status, or speak to an agent. How can I help you?',
    requiresAuth: false,
    priority: 1,
  },
  {
    id: 'main_menu',
    name: 'Main Menu',
    description: 'Return to the main menu',
    samplePhrases: [
      'Main menu',
      'Go back',
      'Start over',
      'Home',
    ],
    action: 'play_message',
    responseTemplate: 'Welcome to BioCycle Peptides. How can I help you today? You can say billing, support, sales, check order status, or speak to an agent.',
    requiresAuth: false,
    priority: 1,
  },
];

// ---------------------------------------------------------------------------
// processSpokenInput
// ---------------------------------------------------------------------------

/**
 * Process spoken input from a caller using NLP intent detection via OpenAI.
 *
 * Takes the transcribed text (from streaming-transcription.ts) and classifies
 * it against configured IVR intents. Returns the best match with confidence
 * score and action to take.
 *
 * @param callId - The call ID for session tracking
 * @param audioTranscript - The transcribed spoken input text
 * @returns Intent match result with confidence and action
 */
export async function processSpokenInput(
  callId: string,
  audioTranscript: string,
): Promise<IntentMatchResult> {
  // Get or create IVR session
  let session = ivrSessions.get(callId);
  if (!session) {
    session = {
      callId,
      attempts: 0,
      lastIntent: null,
      startedAt: new Date(),
      resolved: false,
    };
    ivrSessions.set(callId, session);
  }

  session.attempts++;

  if (!audioTranscript.trim()) {
    logger.debug('Speech IVR: empty transcript', {
      event: 'speech_ivr_empty',
      callId,
      attempt: session.attempts,
    });
    return {
      intent: null,
      confidence: 0,
      transcript: audioTranscript,
      candidates: [],
      isHighConfidence: false,
    };
  }

  const intents = await getIvrIntents();
  const result = await matchIntent(audioTranscript, intents);

  // Update session
  if (result.intent) {
    session.lastIntent = result.intent.id;
  }
  if (result.isHighConfidence) {
    session.resolved = true;
  }

  // Record the interaction for metrics
  await recordSpeechInteraction(callId, audioTranscript, result);

  logger.info('Speech IVR: input processed', {
    event: 'speech_ivr_processed',
    callId,
    transcript: audioTranscript.slice(0, 100),
    matchedIntent: result.intent?.id || 'none',
    confidence: result.confidence,
    isHighConfidence: result.isHighConfidence,
    attempt: session.attempts,
  });

  return result;
}

// ---------------------------------------------------------------------------
// getIvrIntents
// ---------------------------------------------------------------------------

/**
 * Return the configured IVR intents.
 *
 * Currently returns default intents. In production, these could be stored
 * in SiteSettings or a dedicated IvrConfig table for per-tenant customization.
 *
 * @returns Array of configured IVR intents
 */
export async function getIvrIntents(): Promise<IvrIntent[]> {
  // Check for custom intents in audit trail (config storage pattern)
  const trail = await prisma.auditTrail.findFirst({
    where: { entityType: 'IVR_SPEECH_INTENTS', action: 'CONFIG' },
    orderBy: { createdAt: 'desc' },
  });

  if (trail?.metadata) {
    try {
      const meta = trail.metadata as unknown;
      const customIntents = (Array.isArray(meta) ? meta : []) as IvrIntent[];
      if (customIntents.length > 0) {
        return customIntents;
      }
    } catch {
      logger.warn('Speech IVR: invalid custom intents in config', {
        event: 'speech_ivr_bad_config',
      });
    }
  }

  return DEFAULT_INTENTS;
}

// ---------------------------------------------------------------------------
// matchIntent
// ---------------------------------------------------------------------------

/**
 * Match a spoken transcript against configured intents using OpenAI NLP.
 *
 * Sends the transcript and intent definitions to OpenAI for classification.
 * Returns the best match with confidence score and runner-up candidates.
 *
 * @param transcript - The spoken input text
 * @param intents - Available IVR intents to match against
 * @returns Match result with confidence and candidates
 */
export async function matchIntent(
  transcript: string,
  intents: IvrIntent[],
): Promise<IntentMatchResult> {
  if (!transcript.trim() || intents.length === 0) {
    return {
      intent: null,
      confidence: 0,
      transcript,
      candidates: [],
      isHighConfidence: false,
    };
  }

  try {
    const openai = getOpenAI();

    // Build intent descriptions for the prompt
    const intentDescriptions = intents
      .map(
        (i) =>
          `- "${i.id}": ${i.description}. Example phrases: ${i.samplePhrases.slice(0, 3).join(', ')}`,
      )
      .join('\n');

    const completion = await openai.chat.completions.create({
      model: process.env.IVR_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an IVR intent classifier for BioCycle Peptides, a research peptide supplier.\n' +
            'Given a caller\'s spoken input, classify it into one of the available intents.\n\n' +
            'Available intents:\n' +
            intentDescriptions +
            '\n\n' +
            'Respond ONLY with a JSON object: {"intent_id": "...", "confidence": 0.0-1.0, "candidates": [{"intent_id": "...", "confidence": 0.0-1.0}]}.\n' +
            'The "candidates" array should contain the top 3 matches sorted by confidence.\n' +
            'If the input is unclear or does not match any intent, use intent_id "unknown" with low confidence.',
        },
        {
          role: 'user',
          content: `Caller said: "${transcript.slice(0, 500)}"`,
        },
      ],
      max_tokens: 200,
      temperature: 0,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      return {
        intent: null,
        confidence: 0,
        transcript,
        candidates: [],
        isHighConfidence: false,
      };
    }

    const parsed = JSON.parse(raw) as {
      intent_id: string;
      confidence: number;
      candidates: Array<{ intent_id: string; confidence: number }>;
    };

    const matchedIntent = intents.find((i) => i.id === parsed.intent_id) || null;
    const confidence = Math.min(1, Math.max(0, parsed.confidence));

    const candidates = (parsed.candidates || [])
      .filter((c) => intents.some((i) => i.id === c.intent_id))
      .map((c) => ({
        intentId: c.intent_id,
        confidence: Math.min(1, Math.max(0, c.confidence)),
      }));

    return {
      intent: matchedIntent,
      confidence,
      transcript,
      candidates,
      isHighConfidence: confidence >= HIGH_CONFIDENCE_THRESHOLD,
    };
  } catch (error) {
    logger.error('Speech IVR: intent matching failed', {
      event: 'speech_ivr_match_error',
      error: error instanceof Error ? error.message : String(error),
      transcript: transcript.slice(0, 100),
    });

    return {
      intent: null,
      confidence: 0,
      transcript,
      candidates: [],
      isHighConfidence: false,
    };
  }
}

// ---------------------------------------------------------------------------
// generateSpokenResponse
// ---------------------------------------------------------------------------

/**
 * Generate a dynamic TTS response based on the matched intent and caller context.
 *
 * Uses intent response templates and enriches them with CRM data (customer name,
 * order info, account status) when available.
 *
 * @param intent - The matched intent ID
 * @param context - Additional context (caller number, lead data, etc.)
 * @returns The spoken response to play via TTS
 */
export async function generateSpokenResponse(
  intent: string,
  context: Record<string, unknown>,
): Promise<SpokenResponse> {
  const intents = await getIvrIntents();
  const matched = intents.find((i) => i.id === intent);

  if (!matched) {
    return {
      text: 'I am sorry, I did not understand. You can say billing, support, sales, check order status, or ask to speak to an agent.',
      language: 'en-US',
      expectInput: true,
      dtmfFallback: {
        '1': 'billing',
        '2': 'support',
        '3': 'sales',
        '4': 'order_status',
        '0': 'transfer_agent',
      },
    };
  }

  let responseText = matched.responseTemplate || `Connecting you to ${matched.name}. Please hold.`;

  // Enrich with caller data if available
  const callerNumber = context.callerNumber as string | undefined;
  if (callerNumber) {
    const lead = await prisma.crmLead.findFirst({
      where: { phone: callerNumber },
      select: { contactName: true },
    });

    if (lead?.contactName) {
      const firstName = lead.contactName.split(' ')[0];
      responseText = responseText.replace(
        /^(I can|Let me|Welcome)/,
        `${firstName}, $1`,
      );
    }
  }

  // Substitute context variables
  const vars = context as Record<string, string>;
  responseText = responseText.replace(
    /\{(\w+)\}/g,
    (_m, k: string) => vars[k] || '',
  );

  const language = (context.language as string) || 'en-US';

  return {
    text: responseText,
    language,
    expectInput: matched.action === 'collect_data',
    dtmfFallback:
      matched.action === 'play_message'
        ? {
            '1': 'billing',
            '2': 'support',
            '3': 'sales',
            '4': 'order_status',
            '0': 'transfer_agent',
          }
        : undefined,
  };
}

// ---------------------------------------------------------------------------
// handleLowConfidence
// ---------------------------------------------------------------------------

/**
 * Handle cases where speech recognition confidence is too low for auto-routing.
 *
 * Strategies:
 * 1. First attempt: Re-prompt with clearer instructions
 * 2. Second attempt: Offer DTMF fallback
 * 3. Third attempt: Transfer to live agent
 *
 * @param callId - The call ID
 * @param transcript - The low-confidence transcript
 * @returns Response to play and next action
 */
export async function handleLowConfidence(
  callId: string,
  transcript: string,
): Promise<{
  response: SpokenResponse;
  action: 'retry' | 'dtmf_fallback' | 'transfer_agent';
}> {
  const session = ivrSessions.get(callId);
  const attempts = session?.attempts || 1;

  if (attempts >= MAX_RETRY_ATTEMPTS) {
    // Too many retries, transfer to agent
    logger.info('Speech IVR: max retries reached, transferring to agent', {
      event: 'speech_ivr_max_retries',
      callId,
      attempts,
      lastTranscript: transcript.slice(0, 100),
    });

    // Clean up session
    ivrSessions.delete(callId);

    return {
      response: {
        text: 'I am having trouble understanding. Let me connect you with an agent who can help. Please hold.',
        language: 'en-US',
        expectInput: false,
      },
      action: 'transfer_agent',
    };
  }

  if (attempts >= 2) {
    // Offer DTMF fallback on second attempt
    return {
      response: {
        text: 'I did not quite catch that. You can also press: 1 for billing, 2 for support, 3 for sales, 4 for order status, or 0 for an agent.',
        language: 'en-US',
        expectInput: true,
        dtmfFallback: {
          '1': 'billing',
          '2': 'support',
          '3': 'sales',
          '4': 'order_status',
          '0': 'transfer_agent',
        },
      },
      action: 'dtmf_fallback',
    };
  }

  // First retry: re-prompt with clearer instructions
  return {
    response: {
      text: 'Sorry, I did not understand. Please tell me briefly how I can help you. For example, you can say "billing", "support", "place an order", or "check my order status".',
      language: 'en-US',
      expectInput: true,
    },
    action: 'retry',
  };
}

// ---------------------------------------------------------------------------
// getSpeechIvrMetrics
// ---------------------------------------------------------------------------

/**
 * Get speech IVR performance metrics for a time period.
 *
 * Tracks recognition accuracy, intent match rate, fallback frequency,
 * and resolution times. Data is stored in CrmActivity entries with
 * type 'ivr_speech'.
 *
 * @param period - Time period for metrics
 * @returns Speech IVR performance metrics
 */
export async function getSpeechIvrMetrics(period: {
  start: Date;
  end: Date;
}): Promise<SpeechIvrMetrics> {
  // Query IVR speech interactions from CrmActivity
  const activities = await prisma.crmActivity.findMany({
    where: {
      type: 'CALL',
      createdAt: {
        gte: period.start,
        lte: period.end,
      },
      description: { startsWith: 'ivr_speech:' },
    },
    select: {
      description: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  let totalInputs = 0;
  let highConfidenceMatches = 0;
  let fallbackCount = 0;
  let dtmfFallbackCount = 0;
  let totalResolutionTimeSec = 0;
  let resolvedCount = 0;
  const intentCounts = new Map<string, number>();

  for (const activity of activities) {
    const meta = (activity.metadata as Record<string, unknown>) || {};
    totalInputs++;

    const confidence = (meta.confidence as number) || 0;
    const intentId = meta.intentId as string | undefined;
    const action = meta.action as string | undefined;
    const resolutionSec = meta.resolutionTimeSec as number | undefined;

    if (confidence >= HIGH_CONFIDENCE_THRESHOLD && intentId) {
      highConfidenceMatches++;
    }

    if (action === 'retry' || action === 'transfer_agent') {
      fallbackCount++;
    }

    if (action === 'dtmf_fallback') {
      dtmfFallbackCount++;
    }

    if (intentId && intentId !== 'unknown') {
      intentCounts.set(intentId, (intentCounts.get(intentId) || 0) + 1);
    }

    if (resolutionSec !== undefined) {
      totalResolutionTimeSec += resolutionSec;
      resolvedCount++;
    }
  }

  const recognitionAccuracyRate =
    totalInputs > 0
      ? Math.round((highConfidenceMatches / totalInputs) * 1000) / 10
      : 0;

  const intentMatchRate =
    totalInputs > 0
      ? Math.round(
          ((totalInputs - fallbackCount - dtmfFallbackCount) / totalInputs) * 1000,
        ) / 10
      : 0;

  const fallbackRate =
    totalInputs > 0
      ? Math.round(((fallbackCount + dtmfFallbackCount) / totalInputs) * 1000) / 10
      : 0;

  const avgResolutionTimeSec =
    resolvedCount > 0 ? Math.round(totalResolutionTimeSec / resolvedCount) : 0;

  // Top intents sorted by count
  const topIntents = Array.from(intentCounts.entries())
    .map(([intentId, count]) => ({ intentId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  logger.info('Speech IVR: metrics calculated', {
    event: 'speech_ivr_metrics',
    totalInputs,
    highConfidenceMatches,
    fallbackCount,
    recognitionAccuracyRate,
    intentMatchRate,
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
  });

  return {
    totalInputs,
    highConfidenceMatches,
    fallbackCount,
    dtmfFallbackCount,
    recognitionAccuracyRate,
    intentMatchRate,
    fallbackRate,
    avgResolutionTimeSec,
    topIntents,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Record a speech IVR interaction for metrics tracking.
 */
async function recordSpeechInteraction(
  callId: string,
  transcript: string,
  result: IntentMatchResult,
): Promise<void> {
  try {
    // Find the CallLog to get the associated client
    const callLog = await prisma.callLog.findFirst({
      where: {
        OR: [
          { pbxUuid: callId },
          { id: callId },
        ],
      },
      select: { id: true, clientId: true },
    });

    if (!callLog?.clientId) return;

    await prisma.crmActivity.create({
      data: {
        type: 'CALL',
        title: 'IVR Speech Interaction',
        contactId: callLog.clientId,
        description: `ivr_speech: ${transcript.slice(0, 200)}`,
        metadata: {
          source: 'ivr_speech',
          intentId: result.intent?.id || 'unknown',
          confidence: result.confidence,
          isHighConfidence: result.isHighConfidence,
          candidateCount: result.candidates.length,
          callId,
        },
      },
    });
  } catch (error) {
    // Non-critical: don't fail the IVR flow for metrics recording
    logger.debug('Speech IVR: failed to record interaction', {
      event: 'speech_ivr_record_error',
      callId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

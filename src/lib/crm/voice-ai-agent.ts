/**
 * VOICE AI AGENT (K17)
 * Autonomous voice bot that handles calls without human agents.
 * Configurable personality, knowledge base, and escalation rules.
 * Uses OpenAI function-calling for intent detection (FAQ, appointment booking,
 * order status, transfer). Stores agent configs in CrmCampaign.targetCriteria JSON.
 */

import { Prisma } from '@prisma/client';
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

export interface VoiceAgentConfig {
  name: string;
  personality: string;
  knowledgeBase: { topic: string; content: string }[];
  greetingPrompt: string;
  escalationRules: EscalationRule[];
  maxTurns?: number;
  language?: string;
}

export interface EscalationRule {
  trigger: 'low_confidence' | 'negative_sentiment' | 'explicit_request' | 'max_turns' | 'keyword';
  threshold?: number;
  keywords?: string[];
  targetQueue?: string;
}

export interface VoiceInput {
  transcript: string;
  intent?: string;
  sentiment?: number;
}

export interface ConversationContext {
  agentId: string;
  sessionId: string;
  turns: ConversationTurn[];
  currentIntent: string | null;
  detectedEntities: Record<string, string>;
  sentiment: number;
  confidence: number;
  startedAt: Date;
}

export interface ConversationTurn {
  role: 'caller' | 'agent';
  text: string;
  intent?: string;
  timestamp: Date;
}

export interface VoiceResponse {
  text: string;
  action: VoiceAction | null;
  shouldEscalate: boolean;
  escalationReason?: string;
  intent: string;
  confidence: number;
}

export type VoiceAction =
  | { type: 'faq_answer'; topic: string }
  | { type: 'book_appointment'; date?: string; time?: string }
  | { type: 'check_order_status'; orderId?: string; email?: string }
  | { type: 'transfer'; queue: string; reason: string }
  | { type: 'end_call'; reason: string };

export interface VoiceAgentStats {
  totalCalls: number;
  resolvedWithoutHuman: number;
  resolutionRate: number;
  avgDurationSec: number;
  escalationRate: number;
  avgSatisfaction: number;
  intentBreakdown: Record<string, number>;
}

// ---------------------------------------------------------------------------
// In-memory session store
// ---------------------------------------------------------------------------

const _sessions = new Map<string, ConversationContext>();

// ---------------------------------------------------------------------------
// OpenAI function definitions for intent detection
// ---------------------------------------------------------------------------

const INTENT_FUNCTIONS = [
  {
    name: 'answer_faq',
    description: 'Answer a frequently asked question about Attitudes VIP products, shipping, returns, etc.',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'The FAQ topic being asked about' },
        answer: { type: 'string', description: 'The answer to provide' },
      },
      required: ['topic', 'answer'],
    },
  },
  {
    name: 'book_appointment',
    description: 'Book a callback appointment or consultation with a specialist.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Requested date (YYYY-MM-DD)' },
        time: { type: 'string', description: 'Requested time (HH:MM)' },
        reason: { type: 'string', description: 'Reason for the appointment' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'check_order_status',
    description: 'Look up the status of a customer order.',
    parameters: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'The order number or ID' },
        email: { type: 'string', description: 'Customer email for verification' },
      },
    },
  },
  {
    name: 'transfer_to_human',
    description: 'Transfer the call to a human agent when the bot cannot help.',
    parameters: {
      type: 'object',
      properties: {
        queue: { type: 'string', description: 'Target queue: sales, support, billing, management' },
        reason: { type: 'string', description: 'Reason for transfer' },
      },
      required: ['queue', 'reason'],
    },
  },
  {
    name: 'end_call',
    description: 'End the call after successfully resolving the inquiry.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Resolution summary' },
      },
      required: ['reason'],
    },
  },
];

// ---------------------------------------------------------------------------
// Create Voice Agent
// ---------------------------------------------------------------------------

/**
 * Create a new configurable voice agent. Stores the configuration in a
 * CrmCampaign record with type VOICE_AI and the full config in targetCriteria.
 *
 * @param config - Voice agent configuration
 * @param createdById - User ID of the agent creator
 * @returns The created campaign ID serving as the voice agent identifier
 */
export async function createVoiceAgent(
  config: VoiceAgentConfig,
  createdById: string,
): Promise<string> {
  try {
    const campaign = await prisma.crmCampaign.create({
      data: {
        name: `Voice AI: ${config.name}`,
        type: 'CALL',
        status: 'ACTIVE',
        description: `Autonomous voice agent - ${config.personality.slice(0, 200)}`,
        targetCriteria: {
          voiceAgent: true,
          agentName: config.name,
          personality: config.personality,
          knowledgeBase: config.knowledgeBase,
          greetingPrompt: config.greetingPrompt,
          escalationRules: config.escalationRules,
          maxTurns: config.maxTurns ?? 25,
          language: config.language ?? 'en',
          createdAt: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
        createdById,
      },
    });

    logger.info('[VoiceAI] Agent created', {
      agentId: campaign.id,
      name: config.name,
      knowledgeTopics: config.knowledgeBase.length,
      escalationRules: config.escalationRules.length,
    });

    return campaign.id;
  } catch (error) {
    logger.error('[VoiceAI] Failed to create agent', {
      error: error instanceof Error ? error.message : String(error),
      name: config.name,
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Process Voice Input
// ---------------------------------------------------------------------------

/**
 * Process caller speech through OpenAI with function-calling for intent detection.
 * Creates or continues a conversation session and returns the AI response
 * with detected intent and any actions to take.
 *
 * @param agentId - The voice agent (campaign) ID
 * @param input - Caller transcript, optional pre-detected intent and sentiment
 * @param sessionId - Optional existing session ID to continue
 * @returns Voice response with text, action, and escalation status
 */
export async function processVoiceInput(
  agentId: string,
  input: VoiceInput,
  sessionId?: string,
): Promise<VoiceResponse> {
  try {
    // Load agent config
    const campaign = await prisma.crmCampaign.findUnique({
      where: { id: agentId },
      select: { targetCriteria: true },
    });

    if (!campaign?.targetCriteria) {
      throw new Error(`Voice agent not found: ${agentId}`);
    }

    const config = campaign.targetCriteria as Record<string, any>;

    // Get or create session
    const sid = sessionId || `vas_${agentId}_${Date.now()}`;
    let context = _sessions.get(sid);

    if (!context) {
      context = {
        agentId,
        sessionId: sid,
        turns: [],
        currentIntent: null,
        detectedEntities: {},
        sentiment: input.sentiment ?? 0,
        confidence: 1,
        startedAt: new Date(),
      };
      _sessions.set(sid, context);
    }

    // Add caller turn
    context.turns.push({
      role: 'caller',
      text: input.transcript,
      intent: input.intent,
      timestamp: new Date(),
    });

    // Update sentiment
    if (typeof input.sentiment === 'number') {
      context.sentiment = input.sentiment;
    }

    // Check escalation before processing
    const escalation = shouldEscalateToHuman(context, config.escalationRules || []);
    if (escalation.shouldEscalate) {
      const escalationResponse: VoiceResponse = {
        text: "I understand you'd like to speak with a specialist. Let me connect you with one of our team members right away.",
        action: { type: 'transfer', queue: 'support', reason: escalation.reason || 'Escalation triggered' },
        shouldEscalate: true,
        escalationReason: escalation.reason,
        intent: 'escalation',
        confidence: 1,
      };

      context.turns.push({
        role: 'agent',
        text: escalationResponse.text,
        intent: 'escalation',
        timestamp: new Date(),
      });

      return escalationResponse;
    }

    // Build knowledge context
    const knowledgeBase = (config.knowledgeBase as { topic: string; content: string }[]) || [];
    const kbContext = knowledgeBase
      .map((kb) => `[${kb.topic}]: ${kb.content}`)
      .join('\n');

    // Build conversation history for OpenAI
    const messages = [
      {
        role: 'system' as const,
        content:
          `You are ${config.agentName || 'an AI voice assistant'} for Attitudes VIP. ` +
          `${config.personality || 'Be professional, friendly, and concise.'}\n\n` +
          `Knowledge Base:\n${kbContext}\n\n` +
          `Guidelines:\n` +
          `- Keep responses under 3 sentences (this is a phone call, not a chat)\n` +
          `- Be natural and conversational\n` +
          `- Products are for RESEARCH USE ONLY\n` +
          `- If you cannot help, use the transfer_to_human function\n` +
          `- If the caller's issue is resolved, use the end_call function`,
      },
      ...context.turns.map((turn) => ({
        role: (turn.role === 'caller' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: turn.text,
      })),
    ];

    const openai = getOpenAI();

    const completion = await openai.chat.completions.create({
      model: process.env.VOICE_AI_MODEL || 'gpt-4o-mini',
      messages,
      functions: INTENT_FUNCTIONS,
      function_call: 'auto',
      max_tokens: 300,
      temperature: 0.6,
    });

    const choice = completion.choices?.[0];
    const message = choice?.message;

    let responseText = '';
    let action: VoiceAction | null = null;
    let intent = 'general';
    let confidence = 0.8;

    // Handle function call response
    if (message?.function_call) {
      const funcName = message.function_call.name;
      let funcArgs: Record<string, any> = {};

      try {
        funcArgs = JSON.parse(message.function_call.arguments || '{}');
      } catch {
        funcArgs = {};
      }

      switch (funcName) {
        case 'answer_faq':
          intent = 'faq';
          action = { type: 'faq_answer', topic: funcArgs.topic || 'general' };
          responseText = funcArgs.answer || 'Let me look into that for you.';
          confidence = 0.9;
          break;

        case 'book_appointment':
          intent = 'appointment';
          action = { type: 'book_appointment', date: funcArgs.date, time: funcArgs.time };
          responseText = funcArgs.date
            ? `I can schedule a callback for ${funcArgs.date}${funcArgs.time ? ` at ${funcArgs.time}` : ''}. Does that work for you?`
            : 'I can schedule a callback for you. What date and time work best?';
          confidence = 0.85;
          break;

        case 'check_order_status':
          intent = 'order_status';
          action = { type: 'check_order_status', orderId: funcArgs.orderId, email: funcArgs.email };
          responseText = funcArgs.orderId
            ? `Let me look up order ${funcArgs.orderId} for you. One moment please.`
            : 'I can help you check your order status. Could you please provide your order number or the email address you used?';
          confidence = 0.85;
          break;

        case 'transfer_to_human':
          intent = 'transfer';
          action = { type: 'transfer', queue: funcArgs.queue || 'support', reason: funcArgs.reason || 'Caller requested transfer' };
          responseText = `I'll connect you with our ${funcArgs.queue || 'support'} team right away. Please hold for just a moment.`;
          confidence = 0.95;
          break;

        case 'end_call':
          intent = 'end_call';
          action = { type: 'end_call', reason: funcArgs.reason || 'Issue resolved' };
          responseText = 'Thank you for calling Attitudes VIP! Is there anything else I can help you with before we end the call?';
          confidence = 0.9;
          break;

        default:
          responseText = message?.content || "I'm sorry, could you repeat that?";
      }
    } else {
      // Plain text response (no function call)
      responseText = message?.content || "I'm sorry, I didn't quite catch that. Could you repeat?";
    }

    // Update context
    context.currentIntent = intent;
    context.confidence = confidence;
    context.turns.push({
      role: 'agent',
      text: responseText,
      intent,
      timestamp: new Date(),
    });

    logger.info('[VoiceAI] Input processed', {
      agentId,
      sessionId: sid,
      intent,
      confidence,
      turnCount: context.turns.length,
      hasAction: !!action,
    });

    return {
      text: responseText,
      action,
      shouldEscalate: false,
      intent,
      confidence,
    };
  } catch (error) {
    logger.error('[VoiceAI] Failed to process input', {
      agentId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      text: "I'm experiencing a technical issue. Let me connect you with a human agent.",
      action: { type: 'transfer', queue: 'support', reason: 'Technical error in voice AI' },
      shouldEscalate: true,
      escalationReason: 'technical_error',
      intent: 'error',
      confidence: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Generate Voice Response
// ---------------------------------------------------------------------------

/**
 * Generate a TTS-ready response text based on the current conversation context.
 * Useful when you need to regenerate or refine a response without new input.
 *
 * @param agentId - The voice agent ID
 * @param context - Current conversation context
 * @returns TTS-ready response text
 */
export async function generateVoiceResponse(
  agentId: string,
  context: ConversationContext,
): Promise<string> {
  try {
    const campaign = await prisma.crmCampaign.findUnique({
      where: { id: agentId },
      select: { targetCriteria: true },
    });

    if (!campaign?.targetCriteria) {
      return 'Thank you for calling Attitudes VIP. How can I help you?';
    }

    const config = campaign.targetCriteria as Record<string, any>;

    // If no turns yet, return greeting
    if (context.turns.length === 0) {
      return config.greetingPrompt || 'Hello! Thank you for calling Attitudes VIP. How can I assist you today?';
    }

    const openai = getOpenAI();

    const lastCallerMessage = [...context.turns].reverse().find((t) => t.role === 'caller');
    if (!lastCallerMessage) {
      return config.greetingPrompt || 'Hello! How can I help you today?';
    }

    const completion = await openai.chat.completions.create({
      model: process.env.VOICE_AI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            `Generate a concise, natural-sounding phone response for a Attitudes VIP voice agent. ` +
            `Personality: ${config.personality || 'professional and friendly'}. ` +
            `Keep under 2 sentences. Current intent: ${context.currentIntent || 'unknown'}.`,
        },
        {
          role: 'user',
          content: `Caller said: "${lastCallerMessage.text}"\n\nGenerate the voice response:`,
        },
      ],
      max_tokens: 150,
      temperature: 0.6,
    });

    const response = completion.choices?.[0]?.message?.content?.trim();
    return response || 'I apologize, could you please repeat that?';
  } catch (error) {
    logger.error('[VoiceAI] Failed to generate response', {
      agentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 'I apologize for the difficulty. Let me connect you with a team member.';
  }
}

// ---------------------------------------------------------------------------
// Escalation Logic
// ---------------------------------------------------------------------------

/**
 * Evaluate escalation rules against the current conversation context.
 * Returns whether to escalate and the reason.
 *
 * @param context - Current conversation context
 * @param rules - Escalation rules from agent config
 * @returns Escalation decision with reason
 */
export function shouldEscalateToHuman(
  context: ConversationContext,
  rules: EscalationRule[],
): { shouldEscalate: boolean; reason?: string } {
  const callerTurns = context.turns.filter((t) => t.role === 'caller');
  const lastCallerText = callerTurns.length > 0
    ? callerTurns[callerTurns.length - 1].text.toLowerCase()
    : '';

  for (const rule of rules) {
    switch (rule.trigger) {
      case 'low_confidence': {
        const threshold = rule.threshold ?? 0.3;
        if (context.confidence < threshold) {
          return { shouldEscalate: true, reason: `Low confidence (${context.confidence.toFixed(2)} < ${threshold})` };
        }
        break;
      }

      case 'negative_sentiment': {
        const threshold = rule.threshold ?? -0.5;
        if (context.sentiment < threshold) {
          return { shouldEscalate: true, reason: `Negative sentiment (${context.sentiment.toFixed(2)} < ${threshold})` };
        }
        break;
      }

      case 'explicit_request': {
        const escalationPhrases = [
          'speak to someone', 'talk to a person', 'human agent', 'real person',
          'transfer me', 'connect me', 'supervisor', 'manager', 'representative',
          'speak to a human', 'talk to a human', 'agent please',
        ];
        for (const phrase of escalationPhrases) {
          if (lastCallerText.includes(phrase)) {
            return { shouldEscalate: true, reason: `Caller explicitly requested human agent: "${phrase}"` };
          }
        }
        break;
      }

      case 'max_turns': {
        const maxTurns = rule.threshold ?? 20;
        if (callerTurns.length >= maxTurns) {
          return { shouldEscalate: true, reason: `Maximum turns reached (${callerTurns.length} >= ${maxTurns})` };
        }
        break;
      }

      case 'keyword': {
        const keywords = rule.keywords || [];
        for (const kw of keywords) {
          if (lastCallerText.includes(kw.toLowerCase())) {
            return { shouldEscalate: true, reason: `Escalation keyword detected: "${kw}"` };
          }
        }
        break;
      }
    }
  }

  // Default checks even without explicit rules
  const defaultPhrases = ['speak to someone', 'human', 'real person', 'supervisor'];
  for (const phrase of defaultPhrases) {
    if (lastCallerText.includes(phrase)) {
      return { shouldEscalate: true, reason: `Default escalation: caller said "${phrase}"` };
    }
  }

  return { shouldEscalate: false };
}

// ---------------------------------------------------------------------------
// Voice Agent Stats
// ---------------------------------------------------------------------------

/**
 * Retrieve performance statistics for a voice AI agent.
 * Pulls data from CrmActivity records tagged with voiceAgent metadata.
 *
 * @param agentId - The voice agent (campaign) ID
 * @returns Aggregated stats: resolution rate, avg duration, escalation rate, satisfaction
 */
export async function getVoiceAgentStats(agentId: string): Promise<VoiceAgentStats> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Query activities linked to this voice agent
    const activities = await prisma.crmActivity.findMany({
      where: {
        metadata: {
          path: ['voiceAgentId'],
          equals: agentId,
        },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        metadata: true,
        createdAt: true,
      },
    });

    if (activities.length === 0) {
      return {
        totalCalls: 0,
        resolvedWithoutHuman: 0,
        resolutionRate: 0,
        avgDurationSec: 0,
        escalationRate: 0,
        avgSatisfaction: 0,
        intentBreakdown: {},
      };
    }

    let resolvedCount = 0;
    let escalatedCount = 0;
    let totalDuration = 0;
    let satisfactionSum = 0;
    let satisfactionCount = 0;
    const intentBreakdown: Record<string, number> = {};

    for (const activity of activities) {
      const meta = activity.metadata as Record<string, any> | null;
      if (!meta) continue;

      if (meta.resolved === true) resolvedCount++;
      if (meta.escalated === true) escalatedCount++;

      if (typeof meta.durationSec === 'number') {
        totalDuration += meta.durationSec;
      }

      if (typeof meta.satisfaction === 'number') {
        satisfactionSum += meta.satisfaction;
        satisfactionCount++;
      }

      const intent = meta.intent as string;
      if (intent) {
        intentBreakdown[intent] = (intentBreakdown[intent] || 0) + 1;
      }
    }

    const totalCalls = activities.length;

    return {
      totalCalls,
      resolvedWithoutHuman: resolvedCount,
      resolutionRate: totalCalls > 0 ? Math.round((resolvedCount / totalCalls) * 10000) / 100 : 0,
      avgDurationSec: totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0,
      escalationRate: totalCalls > 0 ? Math.round((escalatedCount / totalCalls) * 10000) / 100 : 0,
      avgSatisfaction: satisfactionCount > 0
        ? Math.round((satisfactionSum / satisfactionCount) * 100) / 100
        : 0,
      intentBreakdown,
    };
  } catch (error) {
    logger.error('[VoiceAI] Failed to get agent stats', {
      agentId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      totalCalls: 0,
      resolvedWithoutHuman: 0,
      resolutionRate: 0,
      avgDurationSec: 0,
      escalationRate: 0,
      avgSatisfaction: 0,
      intentBreakdown: {},
    };
  }
}

// ---------------------------------------------------------------------------
// Session Management
// ---------------------------------------------------------------------------

/**
 * Get the current conversation context for a session.
 */
export function getSession(sessionId: string): ConversationContext | null {
  return _sessions.get(sessionId) ?? null;
}

/**
 * End a voice AI session and clean up. Returns the final context summary.
 */
export function endSession(sessionId: string): {
  totalTurns: number;
  durationSec: number;
  finalIntent: string | null;
  finalSentiment: number;
} | null {
  const session = _sessions.get(sessionId);
  if (!session) return null;

  const durationSec = Math.round(
    (Date.now() - session.startedAt.getTime()) / 1000,
  );

  const result = {
    totalTurns: session.turns.length,
    durationSec,
    finalIntent: session.currentIntent,
    finalSentiment: session.sentiment,
  };

  _sessions.delete(sessionId);
  logger.info('[VoiceAI] Session ended', { sessionId, ...result });

  return result;
}

/**
 * Record a completed voice AI call as a CrmActivity for analytics.
 *
 * @param agentId - The voice agent ID
 * @param sessionId - The session ID
 * @param outcome - Whether the call was resolved without escalation
 */
export async function recordVoiceCall(
  agentId: string,
  sessionId: string,
  outcome: {
    resolved: boolean;
    escalated: boolean;
    intent: string;
    durationSec: number;
    satisfaction?: number;
    leadId?: string;
  },
): Promise<void> {
  try {
    await prisma.crmActivity.create({
      data: {
        type: 'CALL',
        title: `Voice AI Call - ${outcome.intent}`,
        description: outcome.resolved
          ? `Resolved by AI agent (${outcome.durationSec}s)`
          : `Escalated to human agent (${outcome.durationSec}s)`,
        leadId: outcome.leadId || null,
        metadata: {
          voiceAgentId: agentId,
          sessionId,
          resolved: outcome.resolved,
          escalated: outcome.escalated,
          intent: outcome.intent,
          durationSec: outcome.durationSec,
          satisfaction: outcome.satisfaction ?? null,
          recordedAt: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
      },
    });

    logger.info('[VoiceAI] Call recorded', { agentId, sessionId, outcome });
  } catch (error) {
    logger.error('[VoiceAI] Failed to record call', {
      agentId,
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

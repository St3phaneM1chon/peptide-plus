/**
 * Voice AI Conversation Memory — Redis-Backed Turn History
 *
 * Maintains conversation context during a Voice AI call:
 * - Stores up to 20 turns (user + assistant messages)
 * - Compresses older turns after 10 to save tokens
 * - TTL = call duration (auto-expires after hangup)
 * - Supports mid-call language switching
 * - Tracks unresolved questions for daily sync
 */

import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  language?: string;
  intent?: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationState {
  callControlId: string;
  callerNumber: string;
  detectedLanguage: string;
  turns: ConversationTurn[];
  createdAt: number;
  lastActivity: number;
  resolved: boolean;
  transferredToAgent: boolean;
  questionsAsked: string[];
  unresolvedQuestions: string[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const MEMORY_PREFIX = 'voiceai:conv:';
const MAX_TURNS = 20;
const COMPRESS_AFTER = 10;
const TTL_SECONDS = 3600; // 1 hour (should outlast any call)
const DAILY_LOG_KEY = 'voiceai:daily_log';

// ── In-Memory Cache ──────────────────────────────────────────────────────────

const memoryCache = new Map<string, ConversationState>();

// ── Conversation Memory Manager ──────────────────────────────────────────────

/**
 * Create a new conversation memory for a call.
 */
export async function createConversation(
  callControlId: string,
  callerNumber: string,
  language: string = 'fr-CA'
): Promise<ConversationState> {
  const state: ConversationState = {
    callControlId,
    callerNumber,
    detectedLanguage: language,
    turns: [],
    createdAt: Date.now(),
    lastActivity: Date.now(),
    resolved: false,
    transferredToAgent: false,
    questionsAsked: [],
    unresolvedQuestions: [],
  };

  memoryCache.set(callControlId, state);
  await persistState(callControlId, state);

  logger.debug('[ConvMemory] Created', {
    callControlId,
    language,
  });

  return state;
}

/**
 * Add a turn to the conversation.
 */
export async function addTurn(
  callControlId: string,
  turn: Omit<ConversationTurn, 'timestamp'>
): Promise<ConversationState | null> {
  const state = memoryCache.get(callControlId) || await loadState(callControlId);
  if (!state) return null;

  const fullTurn: ConversationTurn = {
    ...turn,
    timestamp: Date.now(),
  };

  state.turns.push(fullTurn);
  state.lastActivity = Date.now();

  // Track questions asked by the user
  if (turn.role === 'user' && isQuestion(turn.content)) {
    state.questionsAsked.push(turn.content);
  }

  // Compress if over the threshold
  if (state.turns.length > MAX_TURNS) {
    await compressTurns(state);
  }

  memoryCache.set(callControlId, state);
  await persistState(callControlId, state);

  return state;
}

/**
 * Get the conversation history formatted for LLM context.
 */
export function getMessagesForLLM(
  callControlId: string
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  const state = memoryCache.get(callControlId);
  if (!state) return [];

  return state.turns.map(t => ({
    role: t.role,
    content: t.content,
  }));
}

/**
 * Update the detected language mid-call.
 */
export async function updateLanguage(
  callControlId: string,
  language: string
): Promise<void> {
  const state = memoryCache.get(callControlId);
  if (!state) return;

  state.detectedLanguage = language;
  memoryCache.set(callControlId, state);
  await persistState(callControlId, state);

  logger.info('[ConvMemory] Language updated', {
    callControlId,
    language,
  });
}

/**
 * Mark a question as unresolved (IA couldn't answer → transferred to agent).
 */
export async function markUnresolved(
  callControlId: string,
  question: string
): Promise<void> {
  const state = memoryCache.get(callControlId);
  if (!state) return;

  state.unresolvedQuestions.push(question);
  state.transferredToAgent = true;
  memoryCache.set(callControlId, state);
  await persistState(callControlId, state);
}

/**
 * Mark the conversation as resolved (IA answered successfully).
 */
export async function markResolved(callControlId: string): Promise<void> {
  const state = memoryCache.get(callControlId);
  if (!state) return;

  state.resolved = true;
  memoryCache.set(callControlId, state);
  await persistState(callControlId, state);
}

/**
 * Get the current conversation state.
 */
export function getConversation(callControlId: string): ConversationState | null {
  return memoryCache.get(callControlId) || null;
}

/**
 * End conversation and log for daily sync.
 */
export async function endConversation(callControlId: string): Promise<void> {
  const state = memoryCache.get(callControlId);
  if (!state) return;

  // Log to daily sync queue for Aurelia learning
  await logForDailySync(state);

  memoryCache.delete(callControlId);

  // Delete from Redis
  const redis = await getRedisClient();
  if (redis) {
    await redis.del(`${MEMORY_PREFIX}${callControlId}`);
  }

  logger.info('[ConvMemory] Ended', {
    callControlId,
    turns: state.turns.length,
    resolved: state.resolved,
    transferred: state.transferredToAgent,
    unresolvedCount: state.unresolvedQuestions.length,
  });
}

/**
 * Get all active conversations (for monitoring).
 */
export function getActiveConversations(): Array<{
  callControlId: string;
  callerNumber: string;
  language: string;
  turns: number;
  duration: number;
}> {
  return Array.from(memoryCache.values()).map(s => ({
    callControlId: s.callControlId,
    callerNumber: s.callerNumber,
    language: s.detectedLanguage,
    turns: s.turns.length,
    duration: Math.round((Date.now() - s.createdAt) / 1000),
  }));
}

// ── Private Helpers ──────────────────────────────────────────────────────────

async function persistState(callControlId: string, state: ConversationState): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;

  try {
    const serialized = JSON.stringify(state);
    await redis.set(`${MEMORY_PREFIX}${callControlId}`, serialized, 'EX', TTL_SECONDS);
  } catch {
    // Non-critical — in-memory cache is primary
  }
}

async function loadState(callControlId: string): Promise<ConversationState | null> {
  const redis = await getRedisClient();
  if (!redis) return null;

  try {
    const data = await redis.get(`${MEMORY_PREFIX}${callControlId}`);
    if (data) {
      const state = JSON.parse(data) as ConversationState;
      memoryCache.set(callControlId, state);
      return state;
    }
  } catch {
    // Ignore
  }

  return null;
}

/**
 * Compress older turns to save context window tokens.
 * Keeps the first 2 turns (greeting) + last 8 turns intact,
 * summarizes the middle turns.
 */
async function compressTurns(state: ConversationState): Promise<void> {
  if (state.turns.length <= COMPRESS_AFTER) return;

  const keepFirst = 2;
  const keepLast = 8;

  const firstTurns = state.turns.slice(0, keepFirst);
  const middleTurns = state.turns.slice(keepFirst, -keepLast);
  const lastTurns = state.turns.slice(-keepLast);

  // Summarize the middle turns
  const summaryText = middleTurns
    .filter(t => t.role !== 'system')
    .map(t => `${t.role === 'user' ? 'Client' : 'IA'}: ${t.content}`)
    .join(' | ');

  const summaryTurn: ConversationTurn = {
    role: 'system',
    content: `[Résumé des échanges précédents: ${summaryText.substring(0, 500)}]`,
    timestamp: Date.now(),
  };

  state.turns = [...firstTurns, summaryTurn, ...lastTurns];

  logger.debug('[ConvMemory] Turns compressed', {
    callControlId: state.callControlId,
    before: firstTurns.length + middleTurns.length + lastTurns.length,
    after: state.turns.length,
  });
}

function isQuestion(text: string): boolean {
  const questionIndicators = ['?', 'combien', 'quel', 'comment', 'pourquoi', 'où', 'quand', 'est-ce',
    'how', 'what', 'where', 'when', 'why', 'which', 'can', 'do you', 'is there'];
  const lower = text.toLowerCase();
  return questionIndicators.some(q => lower.includes(q));
}

/**
 * Log conversation to daily sync queue for Aurelia learning.
 */
async function logForDailySync(state: ConversationState): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;

  try {
    const entry = {
      callControlId: state.callControlId,
      callerNumber: state.callerNumber,
      language: state.detectedLanguage,
      duration: Math.round((state.lastActivity - state.createdAt) / 1000),
      turnCount: state.turns.length,
      resolved: state.resolved,
      transferredToAgent: state.transferredToAgent,
      questionsAsked: state.questionsAsked,
      unresolvedQuestions: state.unresolvedQuestions,
      timestamp: new Date().toISOString(),
      // Include conversation summary (not full transcript for privacy)
      summary: state.turns
        .filter(t => t.role === 'user')
        .map(t => t.content.substring(0, 100))
        .slice(0, 10),
    };

    await redis.lpush(DAILY_LOG_KEY, JSON.stringify(entry));
  } catch {
    // Non-critical
  }
}

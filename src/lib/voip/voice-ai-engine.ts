/**
 * Voice AI Engine — Orchestrateur STT → LLM → TTS
 *
 * Le cœur du système Voice AI de classe mondiale:
 * - Pipeline temps réel: Deepgram Nova-2 → GPT-4o → ElevenLabs Turbo v2
 * - RAG avec Knowledge Base (produits, FAQ, Aurelia KB)
 * - Détection automatique de langue (FR/EN/ES)
 * - Mémoire conversationnelle (20 tours, compression)
 * - Fallback cascade: ElevenLabs → Telnyx TTS robot
 * - Décision automatique: répondre ou transférer à agent humain
 *
 * Latence cible: <800ms (STT 300ms + LLM 200ms + TTS 300ms)
 */

import { logger } from '@/lib/logger';
import { EventEmitter } from 'events';
import { DeepgramSTT, createTelephonySTT } from './deepgram-stt';
import { ElevenLabsTTS, createTelephonyTTS, generateTTSRest } from './elevenlabs-tts';
import { stopMediaFork, cleanupMediaFork } from './media-fork';
import { getKnowledgeBase, lookupClientContext } from './knowledge-base';
import type { KBSearchResult, ClientContext } from './knowledge-base';
import {
  createConversation,
  addTurn,
  getMessagesForLLM,
  updateLanguage,
  markUnresolved,
  markResolved,
  endConversation,
} from './conversation-memory';
import * as telnyx from '@/lib/telnyx';

// ── Types ────────────────────────────────────────────────────────────────────

export interface VoiceAIConfig {
  /** LLM model for conversation */
  llmModel?: string;
  /** Max LLM tokens per response */
  maxTokens?: number;
  /** Temperature for LLM */
  temperature?: number;
  /** ElevenLabs voice ID */
  voiceId?: string;
  /** Language override (empty = auto-detect) */
  language?: string;
  /** WebSocket URL for media fork */
  mediaForkUrl?: string;
  /** Enable knowledge base RAG */
  useKnowledgeBase?: boolean;
  /** Max conversation turns before suggesting transfer */
  maxTurns?: number;
  /** Confidence threshold for auto-response (below = transfer to agent) */
  confidenceThreshold?: number;
}

export interface VoiceAISession {
  callControlId: string;
  callerNumber: string;
  dialedNumber: string;
  language: string;
  stt: DeepgramSTT;
  tts: ElevenLabsTTS | null;
  clientContext: ClientContext | null;
  isActive: boolean;
  isSpeaking: boolean;
  startedAt: Date;
  turnCount: number;
}

// ── Active Sessions ──────────────────────────────────────────────────────────

const activeSessions = new Map<string, VoiceAISession>();

// ── System Prompts ───────────────────────────────────────────────────────────

function getSystemPrompt(language: string, clientContext: ClientContext | null): string {
  const isFrench = language.startsWith('fr');

  const clientInfo = clientContext
    ? isFrench
      ? `\n\nCLIENT IDENTIFIÉ:\n- Nom: ${clientContext.name || 'Inconnu'}\n- Tier: ${clientContext.loyaltyTier || 'Standard'}\n- Commandes: ${clientContext.totalOrders || 0}\n${clientContext.lastOrderDate ? `- Dernière commande: ${clientContext.lastOrderDate.split('T')[0]}` : ''}`
      : `\n\nIDENTIFIED CLIENT:\n- Name: ${clientContext.name || 'Unknown'}\n- Tier: ${clientContext.loyaltyTier || 'Standard'}\n- Orders: ${clientContext.totalOrders || 0}\n${clientContext.lastOrderDate ? `- Last order: ${clientContext.lastOrderDate.split('T')[0]}` : ''}`
    : '';

  if (isFrench) {
    return `Tu es l'assistante vocale IA d'Attitudes VIP (BioCycle Peptides), une entreprise canadienne spécialisée dans les peptides de recherche de haute pureté.

PERSONNALITÉ:
- Professionnelle, chaleureuse, posée
- Accent québécois léger naturel
- Concise: 1-3 phrases par réponse MAX
- Tu tutoies JAMAIS — toujours vouvoyer

RÈGLES STRICTES:
- Réponds UNIQUEMENT avec les informations des DONNÉES VÉRIFIÉES fournies
- Si tu ne connais pas la réponse → dis "Je vais vous transférer à un spécialiste" et retourne [TRANSFER]
- JAMAIS inventer de prix, posologie, ou information médicale
- JAMAIS donner de conseil médical — "Nos produits sont destinés à la recherche uniquement"
- Les prix sont en CAD sauf indication contraire
- Si le client demande à parler à un humain → [TRANSFER] immédiatement
- Si c'est la 3e question sans réponse satisfaisante → [TRANSFER]

CAPACITÉS:
- Informations produits (nom, description, prix, options disponibles)
- Statut de commande (si client identifié)
- FAQ et politiques (livraison, retours, garantie)
- Programme de fidélité (tiers, points, avantages)
- Prise de message si personne n'est disponible

FORMAT DE RÉPONSE:
- Texte parlé naturellement (pas de bullet points, pas de markdown)
- Court et direct — tu es au téléphone, pas dans un email
- Si transfert nécessaire: termine par [TRANSFER]
- Si fin de conversation: termine par [END]${clientInfo}`;
  }

  return `You are the AI voice assistant for Attitudes VIP (BioCycle Peptides), a Canadian company specializing in high-purity research peptides.

PERSONALITY:
- Professional, warm, composed
- Concise: 1-3 sentences per response MAX
- Formal but friendly

STRICT RULES:
- ONLY answer using information from the VERIFIED DATA provided
- If you don't know → say "Let me transfer you to a specialist" and return [TRANSFER]
- NEVER make up prices, dosages, or medical information
- NEVER give medical advice — "Our products are for research purposes only"
- Prices are in CAD unless otherwise stated
- If the client asks to speak with a human → [TRANSFER] immediately
- If 3rd question without satisfactory answer → [TRANSFER]

CAPABILITIES:
- Product information (name, description, price, available options)
- Order status (if client identified)
- FAQ and policies (shipping, returns, warranty)
- Loyalty program (tiers, points, benefits)
- Take a message if no one is available

RESPONSE FORMAT:
- Natural spoken text (no bullet points, no markdown)
- Short and direct — you're on the phone, not in an email
- If transfer needed: end with [TRANSFER]
- If conversation over: end with [END]${clientInfo}`;
}

// ── Voice AI Engine ──────────────────────────────────────────────────────────

export class VoiceAIEngine extends EventEmitter {
  private config: Required<VoiceAIConfig>;

  constructor(config: VoiceAIConfig = {}) {
    super();
    this.config = {
      llmModel: config.llmModel || 'gpt-4o',
      maxTokens: config.maxTokens || 150,
      temperature: config.temperature ?? 0.3,
      voiceId: config.voiceId || process.env.ELEVENLABS_VOICE_ID || '',
      language: config.language || '',
      mediaForkUrl: config.mediaForkUrl || process.env.VOICE_AI_MEDIA_FORK_URL || '',
      useKnowledgeBase: config.useKnowledgeBase ?? true,
      maxTurns: config.maxTurns || 15,
      confidenceThreshold: config.confidenceThreshold ?? 0.6,
    };
  }

  /**
   * Start a Voice AI session for an inbound call.
   * Sets up STT, TTS, media fork, and knowledge base.
   */
  async startSession(
    callControlId: string,
    callerNumber: string,
    dialedNumber: string,
    language: string
  ): Promise<VoiceAISession> {
    logger.info('[VoiceAI] Starting session', {
      callControlId,
      callerNumber,
      language,
    });

    // Look up client context by phone number
    const clientContext = await lookupClientContext(callerNumber);
    if (clientContext) {
      logger.info('[VoiceAI] Client identified', {
        name: clientContext.name,
        tier: clientContext.loyaltyTier,
        orders: clientContext.totalOrders,
      });
    }

    // Initialize STT
    const stt = createTelephonySTT({
      language: this.config.language || undefined,
      detectLanguage: !this.config.language,
    });

    // Initialize TTS (nullable — fallback to Telnyx if ElevenLabs unavailable)
    let tts: ElevenLabsTTS | null = null;
    if (process.env.ELEVENLABS_API_KEY) {
      tts = createTelephonyTTS({ voiceId: this.config.voiceId || undefined });
    }

    const session: VoiceAISession = {
      callControlId,
      callerNumber,
      dialedNumber,
      language,
      stt,
      tts,
      clientContext,
      isActive: true,
      isSpeaking: false,
      startedAt: new Date(),
      turnCount: 0,
    };

    activeSessions.set(callControlId, session);

    // Create conversation memory
    await createConversation(callControlId, callerNumber, language);

    // Load knowledge base if not already loaded
    if (this.config.useKnowledgeBase) {
      const kb = getKnowledgeBase();
      if (kb.getStats().totalChunks === 0) {
        kb.load().catch(() => {});
      }
    }

    // Connect STT and set up event handlers
    try {
      await stt.connect();
      this.setupSTTHandlers(session);
    } catch (err) {
      logger.error('[VoiceAI] STT connection failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Continue without STT — will fall back to DTMF
    }

    // Connect TTS
    if (tts) {
      try {
        await tts.connect();
        this.setupTTSHandlers(session);
      } catch (err) {
        logger.warn('[VoiceAI] TTS connection failed, will use Telnyx TTS fallback', {
          error: err instanceof Error ? err.message : String(err),
        });
        session.tts = null;
      }
    }

    // Play greeting
    await this.playGreeting(session);

    return session;
  }

  /**
   * Process incoming audio data from Media Fork.
   */
  processAudio(callControlId: string, audioData: Buffer): void {
    const session = activeSessions.get(callControlId);
    if (!session?.isActive || !session.stt.connected) return;

    session.stt.sendAudio(audioData);
  }

  /**
   * Stop the Voice AI session (called on hangup or transfer).
   */
  async stopSession(callControlId: string): Promise<void> {
    const session = activeSessions.get(callControlId);
    if (!session) return;

    session.isActive = false;

    // Close STT and TTS connections
    await session.stt.close();
    if (session.tts) {
      await session.tts.close();
    }

    // Stop media fork
    await stopMediaFork(callControlId).catch(() => {});
    cleanupMediaFork(callControlId);

    // End conversation memory (logs for daily sync)
    await endConversation(callControlId);

    activeSessions.delete(callControlId);

    logger.info('[VoiceAI] Session ended', {
      callControlId,
      duration: Math.round((Date.now() - session.startedAt.getTime()) / 1000),
      turns: session.turnCount,
    });
  }

  /**
   * Get an active session.
   */
  getSession(callControlId: string): VoiceAISession | undefined {
    return activeSessions.get(callControlId);
  }

  /**
   * Check if a Voice AI session is active for a call.
   */
  isSessionActive(callControlId: string): boolean {
    return activeSessions.has(callControlId);
  }

  // ── Private: Event Handlers ────────────────────────────────────────────────

  private setupSTTHandlers(session: VoiceAISession): void {
    const { stt, callControlId } = session;

    // Handle final transcription results
    stt.on('transcript', async (result: { text: string; confidence: number; language?: string }) => {
      if (!session.isActive || !result.text.trim()) return;

      // Skip if the AI is currently speaking (echo prevention)
      if (session.isSpeaking) return;

      logger.info('[VoiceAI] User said', {
        callControlId,
        text: result.text.substring(0, 100),
        confidence: result.confidence.toFixed(2),
      });

      // Update language if detected
      if (result.language && result.language !== session.language) {
        session.language = result.language;
        await updateLanguage(callControlId, result.language);
      }

      // Process the user's speech
      await this.processUserSpeech(session, result.text);
    });

    // Handle utterance end (silence detection)
    stt.on('utterance_end', () => {
      // Could be used for turn-taking logic
    });

    stt.on('error', (err: Error) => {
      logger.error('[VoiceAI] STT error', {
        callControlId,
        error: err.message,
      });
    });
  }

  private setupTTSHandlers(session: VoiceAISession): void {
    if (!session.tts) return;

    session.tts.on('audio', (chunk: { audio: Buffer; isFinal: boolean }) => {
      // Audio chunk received — send to Telnyx call
      this.emit('tts_audio', {
        callControlId: session.callControlId,
        audio: chunk.audio,
        isFinal: chunk.isFinal,
      });
    });

    session.tts.on('done', () => {
      session.isSpeaking = false;
    });

    session.tts.on('error', (err: Error) => {
      logger.warn('[VoiceAI] TTS error', {
        callControlId: session.callControlId,
        error: err.message,
      });
      session.isSpeaking = false;
    });
  }

  // ── Private: Core Pipeline ─────────────────────────────────────────────────

  private async playGreeting(session: VoiceAISession): Promise<void> {
    const { callControlId, language, clientContext } = session;
    const isFrench = language.startsWith('fr');
    const isBilingual = session.dialedNumber === '+18443040370'; // Toll-Free

    let greeting: string;

    if (clientContext?.name) {
      const firstName = clientContext.name.split(' ')[0];
      greeting = isFrench
        ? `Bonjour ${firstName}! Merci d'appeler Attitudes VIP. Cet appel peut être enregistré. Comment puis-je vous aider?`
        : `Hello ${firstName}! Thank you for calling Attitudes VIP. This call may be recorded. How can I help you?`;
    } else if (isBilingual) {
      greeting = 'Bonjour, hello! Merci d\'appeler Attitudes VIP. Thank you for calling. Comment puis-je vous aider? How can I help you?';
    } else {
      greeting = isFrench
        ? 'Bienvenue chez Attitudes VIP. Cet appel peut être enregistré à des fins de qualité. Comment puis-je vous aider?'
        : 'Welcome to Attitudes VIP. This call may be recorded for quality purposes. How can I help you?';
    }

    // Add greeting to conversation memory
    await addTurn(callControlId, {
      role: 'assistant',
      content: greeting,
      language,
    });

    // Speak the greeting
    await this.speak(session, greeting);
  }

  /**
   * Process user speech: RAG search → LLM → TTS response.
   */
  private async processUserSpeech(session: VoiceAISession, userText: string): Promise<void> {
    const { callControlId, language } = session;
    session.turnCount++;

    // Add user turn to memory
    await addTurn(callControlId, {
      role: 'user',
      content: userText,
      language,
    });

    // Check for transfer intent
    if (this.isTransferRequest(userText, language)) {
      await this.transferToAgent(session, userText);
      return;
    }

    // Check max turns
    if (session.turnCount >= this.config.maxTurns) {
      const msg = language.startsWith('fr')
        ? 'Pour mieux vous aider, je vais vous transférer à un de nos spécialistes. Un instant s\'il vous plaît.'
        : 'To better assist you, let me transfer you to one of our specialists. One moment please.';
      await this.speak(session, msg);
      await this.transferToAgent(session, 'Max turns reached');
      return;
    }

    try {
      // RAG: Search knowledge base
      let ragContext = '';
      if (this.config.useKnowledgeBase) {
        const kb = getKnowledgeBase();
        const results: KBSearchResult[] = await kb.search(userText, { limit: 5 });
        ragContext = kb.buildRAGContext(results);
      }

      // LLM: Generate response
      const conversationHistory = getMessagesForLLM(callControlId);
      const response = await this.callLLM(session, userText, ragContext, conversationHistory);

      // Check for transfer signal in LLM response
      if (response.includes('[TRANSFER]')) {
        const cleanResponse = response.replace('[TRANSFER]', '').trim();
        if (cleanResponse) {
          await this.speak(session, cleanResponse);
        }
        await markUnresolved(callControlId, userText);
        await this.transferToAgent(session, userText);
        return;
      }

      // Check for end signal
      if (response.includes('[END]')) {
        const cleanResponse = response.replace('[END]', '').trim();
        if (cleanResponse) {
          await this.speak(session, cleanResponse);
        }
        await markResolved(callControlId);
        return;
      }

      // Add assistant response to memory
      await addTurn(callControlId, {
        role: 'assistant',
        content: response,
        language,
      });

      // Speak the response
      await this.speak(session, response);
      await markResolved(callControlId);
    } catch (err) {
      logger.error('[VoiceAI] Pipeline error', {
        callControlId,
        error: err instanceof Error ? err.message : String(err),
      });

      // On error, transfer to agent
      const errorMsg = language.startsWith('fr')
        ? 'Excusez-moi, je rencontre une difficulté technique. Je vous transfère à un agent.'
        : 'I apologize, I\'m experiencing a technical difficulty. Let me transfer you to an agent.';
      await this.speak(session, errorMsg);
      await this.transferToAgent(session, 'Pipeline error');
    }
  }

  /**
   * Call the LLM (GPT-4o) with RAG context and conversation history.
   */
  private async callLLM(
    session: VoiceAISession,
    userText: string,
    ragContext: string,
    history: Array<{ role: string; content: string }>
  ): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const systemPrompt = getSystemPrompt(session.language, session.clientContext);

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add RAG context if available
    if (ragContext) {
      messages.push({
        role: 'system',
        content: ragContext,
      });
    }

    // Add conversation history (skip system messages)
    for (const turn of history.slice(-10)) {
      if (turn.role !== 'system') {
        messages.push(turn);
      }
    }

    // Add current user message (if not already in history)
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role !== 'user' || lastMsg?.content !== userText) {
      messages.push({ role: 'user', content: userText });
    }

    const startTime = Date.now();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.llmModel,
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`LLM API error ${response.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const llmResponse = data.choices[0]?.message?.content?.trim() || '';

    logger.info('[VoiceAI] LLM response', {
      callControlId: session.callControlId,
      latencyMs: Date.now() - startTime,
      responseLength: llmResponse.length,
      response: llmResponse.substring(0, 120),
    });

    return llmResponse;
  }

  /**
   * Speak text to the caller via TTS.
   * Cascade: ElevenLabs → Telnyx TTS (robot fallback).
   */
  private async speak(session: VoiceAISession, text: string): Promise<void> {
    if (!text.trim()) return;

    session.isSpeaking = true;

    try {
      if (session.tts?.connected) {
        // ElevenLabs streaming TTS
        session.tts.sendText(text);
        session.tts.flush();

        // Wait for TTS to finish (with timeout)
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            session.isSpeaking = false;
            resolve();
          }, 10_000);

          session.tts!.once('done', () => {
            clearTimeout(timeout);
            session.isSpeaking = false;
            resolve();
          });
        });
      } else if (process.env.ELEVENLABS_API_KEY) {
        // ElevenLabs REST fallback (non-streaming)
        const audioBuffer = await generateTTSRest(text);
        // TODO: Play audio buffer via Telnyx (needs audio hosting or inline audio)
        // For now, fall through to Telnyx TTS
        if (audioBuffer.length > 0) {
          // Audio generated but we need a URL to play it
          // Fall through to Telnyx speakText for now
        }
        await telnyx.speakText(session.callControlId, text, {
          language: session.language,
          voice: 'female',
        });
        session.isSpeaking = false;
      } else {
        // Telnyx TTS fallback (robot voice)
        await telnyx.speakText(session.callControlId, text, {
          language: session.language,
          voice: 'female',
        });
        session.isSpeaking = false;
      }
    } catch (err) {
      session.isSpeaking = false;
      logger.warn('[VoiceAI] TTS failed, using Telnyx fallback', {
        error: err instanceof Error ? err.message : String(err),
      });

      // Ultimate fallback: Telnyx robot TTS
      try {
        await telnyx.speakText(session.callControlId, text, {
          language: session.language,
          voice: 'female',
        });
      } catch {
        logger.error('[VoiceAI] All TTS methods failed', {
          callControlId: session.callControlId,
        });
      }
    }
  }

  /**
   * Transfer the call to a human agent.
   */
  private async transferToAgent(session: VoiceAISession, reason: string): Promise<void> {
    const { callControlId } = session;

    await markUnresolved(callControlId, reason);

    // Stop the Voice AI session
    session.isActive = false;
    await session.stt.close();
    if (session.tts) {
      await session.tts.close();
    }

    // Emit transfer event (handled by call-control.ts)
    this.emit('transfer', {
      callControlId,
      reason,
      language: session.language,
      clientContext: session.clientContext,
      turnCount: session.turnCount,
    });

    logger.info('[VoiceAI] Transferring to agent', {
      callControlId,
      reason: reason.substring(0, 100),
      turns: session.turnCount,
    });
  }

  /**
   * Detect if the user is explicitly asking to speak with a human.
   */
  private isTransferRequest(text: string, language: string): boolean {
    const lower = text.toLowerCase();

    const frTransferPhrases = [
      'parler à quelqu', 'parler a quelqu', 'un agent', 'une personne',
      'un humain', 'un représentant', 'un conseiller', 'la réception',
      'transférer', 'transferer', 'opérateur', 'operateur',
    ];

    const enTransferPhrases = [
      'speak to someone', 'speak with someone', 'talk to a person',
      'human', 'agent', 'representative', 'operator', 'transfer me',
      'real person', 'live agent', 'reception',
    ];

    const phrases = language.startsWith('fr') ? frTransferPhrases : enTransferPhrases;
    return phrases.some(p => lower.includes(p));
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let _engine: VoiceAIEngine | null = null;

export function getVoiceAIEngine(): VoiceAIEngine {
  if (!_engine) {
    _engine = new VoiceAIEngine();
  }
  return _engine;
}

/**
 * Check if Voice AI is available (API keys configured).
 */
export function isVoiceAIAvailable(): boolean {
  return !!(
    process.env.DEEPGRAM_API_KEY &&
    process.env.OPENAI_API_KEY
    // ELEVENLABS_API_KEY is optional (falls back to Telnyx TTS)
  );
}

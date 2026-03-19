/**
 * Conversational IVR — GPT-Powered Natural Language IVR
 *
 * Features:
 * - GPT-based natural language understanding instead of DTMF-only menus
 * - Intent detection and entity extraction from caller speech
 * - Configurable transfer rules (intent → extension/queue mapping)
 * - Conversation memory within a call (multi-turn dialogue)
 * - Fallback to keypad input when NLU confidence is low
 * - Greeting generation and timeout handling
 * - Max turns limit to prevent infinite loops
 */

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConversationalIVRConfig {
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
  maxTurns?: number;
  language?: string;
  fallbackToKeypad?: boolean;
  transferRules?: Array<{
    intent: string;
    destination: string; // extension number or queue name
    confirmationRequired?: boolean;
  }>;
}

export interface IVRTurn {
  role: 'system' | 'caller' | 'ivr';
  content: string;
  intent?: string;
  entities?: Record<string, string>;
  timestamp: number;
}

export interface IVRAction {
  type: 'speak' | 'transfer' | 'voicemail' | 'hangup' | 'collect_input' | 'hold';
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Internal types for OpenAI Chat Completion
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  error?: { message?: string };
}

// ---------------------------------------------------------------------------
// Default system prompt
// ---------------------------------------------------------------------------

const DEFAULT_SYSTEM_PROMPT = `You are a professional phone IVR assistant for Attitudes VIP.
Your role is to understand what the caller needs and route them appropriately.

IMPORTANT RULES:
- Be concise and professional. Keep responses under 2 sentences.
- Always respond in the caller's language (default: French).
- Detect the caller's intent from their speech.
- If you detect an intent, include it in your response as [INTENT:intent_name].
- If you detect entities (name, order number, etc.), include them as [ENTITY:key=value].

Available intents:
- sales: Caller wants to place an order or learn about products → Stéphane
- support: Caller has a question or problem with an existing order → Caroline
- billing: Caller has a billing or payment question → Caroline
- tech_support: Caller has a technical issue or needs technical help → Stéphane
- shipping: Caller is asking about shipping or delivery status → Caroline
- returns: Caller wants to return a product or get a refund → Caroline
- speak_agent: Caller explicitly asks to speak with a person → Stéphane
- voicemail: Caller wants to leave a message
- hours: Caller is asking about business hours
- unknown: You cannot determine what the caller needs

If the caller's intent is unclear after 2 attempts, offer to transfer to a live agent.`;

// ---------------------------------------------------------------------------
// ConversationalIVR
// ---------------------------------------------------------------------------

export class ConversationalIVR {
  private config: Required<ConversationalIVRConfig>;
  private conversation: IVRTurn[] = [];
  private turnCount = 0;

  constructor(config?: ConversationalIVRConfig) {
    this.config = {
      apiKey: config?.apiKey || process.env.OPENAI_API_KEY || '',
      model: config?.model || 'gpt-4o-mini',
      systemPrompt: config?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      maxTurns: config?.maxTurns ?? 8,
      language: config?.language || 'fr',
      fallbackToKeypad: config?.fallbackToKeypad ?? true,
      transferRules: config?.transferRules || [
        { intent: 'sales', destination: 'stephane-queue' },
        { intent: 'support', destination: 'caroline-queue' },
        { intent: 'billing', destination: 'caroline-queue' },
        { intent: 'tech_support', destination: 'stephane-queue' },
        { intent: 'shipping', destination: 'caroline-queue' },
        { intent: 'returns', destination: 'caroline-queue' },
        { intent: 'speak_agent', destination: 'stephane-queue' },
        { intent: 'voicemail', destination: 'voicemail' },
      ],
    };
  }

  /**
   * Process caller speech input and determine the next IVR action.
   * Returns an action the PBX should execute (speak, transfer, etc.).
   */
  async processInput(callerText: string): Promise<IVRAction> {
    this.turnCount++;

    // Record caller turn
    this.conversation.push({
      role: 'caller',
      content: callerText,
      timestamp: Date.now(),
    });

    // Check turn limit
    if (this.turnCount > this.config.maxTurns) {
      logger.info('[ConversationalIVR] Max turns reached, transferring to agent', {
        turns: this.turnCount,
      });

      return {
        type: 'transfer',
        data: {
          destination: 'stephane-queue',
          reason: 'max_turns_exceeded',
          message: "Je vous transfère à un agent qui pourra mieux vous aider.",
        },
      };
    }

    // Generate response via GPT
    const response = await this.generateResponse(callerText);

    // Record IVR response
    this.conversation.push({
      role: 'ivr',
      content: response.text,
      intent: response.intent || undefined,
      timestamp: Date.now(),
    });

    // If an action was determined, return it
    if (response.action) {
      return response.action;
    }

    // Default: speak the response and wait for more input
    return {
      type: 'speak',
      data: { text: response.text, language: this.config.language },
    };
  }

  /**
   * Generate a response using GPT and extract intent/entities/action.
   */
  private async generateResponse(
    _callerText: string
  ): Promise<{ text: string; intent?: string; action?: IVRAction }> {
    if (!this.config.apiKey) {
      logger.warn('[ConversationalIVR] No API key configured, using fallback');
      return this.fallbackResponse();
    }

    // Build message history for context
    const messages: ChatMessage[] = [
      { role: 'system', content: this.config.systemPrompt },
    ];

    // Add conversation history (last 6 turns for context window efficiency)
    const recentTurns = this.conversation.slice(-6);
    for (const turn of recentTurns) {
      if (turn.role === 'caller') {
        messages.push({ role: 'user', content: turn.content });
      } else if (turn.role === 'ivr') {
        messages.push({ role: 'assistant', content: turn.content });
      }
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          max_tokens: 150,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API ${response.status}: ${errText}`);
      }

      const data: ChatCompletionResponse = await response.json();

      if (data.error) {
        throw new Error(`OpenAI error: ${data.error.message}`);
      }

      const rawText = data.choices?.[0]?.message?.content?.trim() || '';

      // Extract intent tag from response
      const intent = this.extractIntent(rawText);

      // Extract entities from response
      const entities = this.extractEntities(rawText);

      // Clean the response text (remove intent/entity tags)
      const cleanText = rawText
        .replace(/\[INTENT:[^\]]+\]/g, '')
        .replace(/\[ENTITY:[^\]]+\]/g, '')
        .trim();

      // Update last conversation turn with extracted data
      const lastTurn = this.conversation[this.conversation.length - 1];
      if (lastTurn) {
        lastTurn.intent = intent || undefined;
        lastTurn.entities = Object.keys(entities).length > 0 ? entities : undefined;
      }

      // Map intent to action if we have a match
      let action: IVRAction | undefined;
      if (intent) {
        const mappedAction = this.mapIntentToAction(intent);
        if (mappedAction) {
          action = mappedAction;
        }
      }

      logger.info('[ConversationalIVR] Response generated', {
        turn: this.turnCount,
        intent,
        entities,
        hasAction: !!action,
      });

      return { text: cleanText || "Comment puis-je vous aider?", intent: intent || undefined, action };
    } catch (error) {
      logger.error('[ConversationalIVR] GPT call failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return this.fallbackResponse();
    }
  }

  /**
   * Extract the [INTENT:xxx] tag from the GPT response.
   */
  private extractIntent(response: string): string | null {
    const match = response.match(/\[INTENT:(\w+)\]/);
    return match ? match[1] : null;
  }

  /**
   * Extract [ENTITY:key=value] tags from the GPT response.
   */
  private extractEntities(response: string): Record<string, string> {
    const entities: Record<string, string> = {};
    const regex = /\[ENTITY:(\w+)=([^\]]+)\]/g;
    let match;
    while ((match = regex.exec(response)) !== null) {
      entities[match[1]] = match[2];
    }
    return entities;
  }

  /**
   * Map a detected intent to a concrete IVR action using transferRules.
   */
  private mapIntentToAction(intent: string): IVRAction | null {
    const rule = this.config.transferRules.find(r => r.intent === intent);

    if (!rule) {
      return null;
    }

    if (intent === 'voicemail' || rule.destination === 'voicemail') {
      return {
        type: 'voicemail',
        data: {
          message: "Je vous dirige vers la messagerie vocale. Veuillez laisser votre message après le bip.",
        },
      };
    }

    if (intent === 'hours') {
      return {
        type: 'speak',
        data: {
          text: "Nos heures d'ouverture sont du lundi au vendredi, de 9h à 17h, heure de l'Est.",
          language: this.config.language,
        },
      };
    }

    return {
      type: 'transfer',
      data: {
        destination: rule.destination,
        intent,
        confirmationRequired: rule.confirmationRequired ?? false,
        message: `Je vous transfère au service approprié. Veuillez patienter.`,
      },
    };
  }

  /**
   * Get the full conversation history for this call.
   */
  getConversation(): IVRTurn[] {
    return [...this.conversation];
  }

  /**
   * Reset the IVR state for a new call.
   */
  reset(): void {
    this.conversation = [];
    this.turnCount = 0;

    logger.info('[ConversationalIVR] Reset for new call');
  }

  /**
   * Get the greeting message to play at the start of a call.
   */
  getGreeting(): string {
    if (this.config.language === 'fr') {
      return "Bienvenue chez Attitudes VIP. Comment puis-je vous aider aujourd'hui? " +
        "Vous pouvez me parler naturellement ou appuyer sur 0 pour un agent.";
    }

    return "Welcome to Attitudes VIP. How can I help you today? " +
      "You can speak naturally or press 0 for an agent.";
  }

  /**
   * Handle timeout when the caller does not provide input.
   * After two timeouts, falls back to keypad or transfers to agent.
   */
  handleTimeout(): IVRAction {
    this.turnCount++;

    if (this.turnCount <= 2) {
      const prompt = this.config.language === 'fr'
        ? "Je n'ai pas entendu votre réponse. Comment puis-je vous aider?"
        : "I didn't hear your response. How can I help you?";

      return {
        type: 'speak',
        data: { text: prompt, language: this.config.language },
      };
    }

    // After 2 timeouts, offer keypad fallback or transfer
    if (this.config.fallbackToKeypad) {
      const keypadPrompt = this.config.language === 'fr'
        ? "Appuyez sur 1 pour les ventes, 2 pour le support, ou 0 pour parler à un agent."
        : "Press 1 for sales, 2 for support, or 0 to speak with an agent.";

      return {
        type: 'collect_input',
        data: {
          text: keypadPrompt,
          maxDigits: 1,
          timeoutSecs: 10,
          language: this.config.language,
        },
      };
    }

    // Transfer to general queue
    return {
      type: 'transfer',
      data: {
        destination: 'stephane-queue',
        reason: 'timeout',
        message: this.config.language === 'fr'
          ? "Je vous transfère à un agent. Veuillez patienter."
          : "Transferring you to an agent. Please hold.",
      },
    };
  }

  /**
   * Fallback response when GPT is unavailable.
   */
  private fallbackResponse(): { text: string; intent?: string; action?: IVRAction } {
    if (this.config.fallbackToKeypad) {
      return {
        text: this.config.language === 'fr'
          ? "Notre assistant vocal est temporairement indisponible. Veuillez utiliser le clavier."
          : "Our voice assistant is temporarily unavailable. Please use your keypad.",
        action: {
          type: 'collect_input',
          data: {
            text: this.config.language === 'fr'
              ? "Appuyez sur 1 pour les ventes, 2 pour le support, ou 0 pour un agent."
              : "Press 1 for sales, 2 for support, or 0 for an agent.",
            maxDigits: 1,
            timeoutSecs: 10,
            language: this.config.language,
          },
        },
      };
    }

    return {
      text: this.config.language === 'fr'
        ? "Je vous transfère à un agent. Veuillez patienter."
        : "Transferring you to an agent. Please hold.",
      action: {
        type: 'transfer',
        data: { destination: 'stephane-queue', reason: 'gpt_unavailable' },
      },
    };
  }
}

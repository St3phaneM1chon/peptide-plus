/**
 * AI CHATBOT ENGINE
 * Processes user messages through an AI model with configurable FAQ data,
 * personality, and escalation rules.
 * Uses OpenAI (lazy-initialized). Supports human escalation detection.
 */

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatbotConfig {
  greeting: string;
  personality: string;
  faqData: { q: string; a: string }[];
  escalationKeywords: string[];
  maxTurns: number;
}

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

  // Dynamic import to avoid build issues
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { default: OpenAI } = require('openai');
  const client: OpenAIClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  _openai = client;
  return client;
}

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

/**
 * Returns the default chatbot configuration with BioCycle Peptides FAQ,
 * a professional yet friendly personality, and common escalation keywords.
 */
export function getDefaultChatbotConfig(): ChatbotConfig {
  return {
    greeting:
      'Hello! Welcome to BioCycle Peptides. How can I help you today? I can answer questions about our products, shipping, and orders.',
    personality:
      'You are a helpful, professional customer support agent for BioCycle Peptides, a research peptide supplier. ' +
      'Be concise, friendly, and knowledgeable about peptide research supplies. ' +
      'Always clarify that products are for research use only. ' +
      'If you do not know the answer, offer to connect the customer with a human agent.',
    faqData: [
      {
        q: 'What are your shipping times?',
        a: 'We ship within 1-2 business days. Standard delivery takes 3-5 business days within Canada, 5-10 business days internationally.',
      },
      {
        q: 'Do you offer international shipping?',
        a: 'Yes, we ship internationally to most countries. Shipping costs and times vary by destination.',
      },
      {
        q: 'What is your return policy?',
        a: 'We accept returns within 30 days of purchase for unopened products in original packaging. Contact support for a return authorization.',
      },
      {
        q: 'Are your peptides for human consumption?',
        a: 'No. All our peptides are strictly for research purposes only. They are not intended for human consumption, veterinary use, or any clinical applications.',
      },
      {
        q: 'How do I track my order?',
        a: 'Once your order ships, you will receive a tracking number via email. You can also check order status in your account dashboard.',
      },
      {
        q: 'What payment methods do you accept?',
        a: 'We accept Visa, Mastercard, American Express, PayPal, and bank transfers for larger orders.',
      },
      {
        q: 'Do you offer bulk or wholesale pricing?',
        a: 'Yes, we offer volume discounts for research institutions and repeat customers. Contact our sales team for a custom quote.',
      },
    ],
    escalationKeywords: [
      'speak to human',
      'talk to agent',
      'real person',
      'manager',
      'supervisor',
      'complaint',
      'lawsuit',
      'legal',
      'refund',
      'angry',
      'furious',
      'unacceptable',
    ],
    maxTurns: 20,
  };
}

// ---------------------------------------------------------------------------
// Process user message
// ---------------------------------------------------------------------------

/**
 * Process a user message through the AI chatbot engine.
 * Uses conversation history and FAQ context to generate a relevant response.
 */
export async function processUserMessage(
  message: string,
  conversationHistory: { role: string; content: string }[],
  config: ChatbotConfig,
): Promise<string> {
  // Check for escalation first
  const sentiment = estimateSentiment(message);
  if (shouldEscalateToHuman(message, sentiment)) {
    return "I understand you'd like to speak with a human agent. Let me connect you with one of our team members. Please hold on a moment, and someone will be with you shortly.";
  }

  // Check if conversation exceeds max turns
  const userTurns = conversationHistory.filter((m) => m.role === 'user').length;
  if (userTurns >= config.maxTurns) {
    return "We've been chatting for a while. Let me connect you with a human agent who can better assist you. Please hold on.";
  }

  // Build FAQ context
  const faqContext = config.faqData
    .map((faq) => `Q: ${faq.q}\nA: ${faq.a}`)
    .join('\n\n');

  // Build system prompt
  const systemPrompt = `${config.personality}

Here is our FAQ knowledge base that you should use to answer questions:

${faqContext}

Important guidelines:
- Be concise and direct in your responses
- If the question is not covered by the FAQ, use your general knowledge but stay on topic
- Never make up specific prices, product availability, or order details
- If someone asks about a specific order, ask for their order number and offer to connect with a human agent
- Products are for RESEARCH USE ONLY - always mention this when discussing products`;

  try {
    const openai = getOpenAI();

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.CHATBOT_MODEL || 'gpt-4o-mini',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const reply = completion.choices?.[0]?.message?.content;
    if (!reply) {
      logger.warn('[Chatbot] Empty response from AI', { message });
      return "I'm sorry, I wasn't able to process your question. Could you please rephrase it?";
    }

    return reply;
  } catch (error) {
    logger.error('[Chatbot] AI processing failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return "I'm experiencing a technical issue right now. Let me connect you with a human agent who can help.";
  }
}

// ---------------------------------------------------------------------------
// Escalation detection
// ---------------------------------------------------------------------------

/**
 * Determines whether a message should be escalated to a human agent.
 * Returns true if the sentiment is strongly negative or escalation keywords are found.
 */
export function shouldEscalateToHuman(
  message: string,
  sentiment: number,
): boolean {
  // Negative sentiment threshold
  if (sentiment < -0.5) {
    return true;
  }

  // Check for escalation keywords
  const lowerMessage = message.toLowerCase();
  const defaultKeywords = getDefaultChatbotConfig().escalationKeywords;

  for (const keyword of defaultKeywords) {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Simple sentiment estimation (no AI call, keyword-based)
// ---------------------------------------------------------------------------

/**
 * Quick keyword-based sentiment estimate.
 * Returns a score between -1 (very negative) and 1 (very positive).
 * Used for fast escalation checks without an API call.
 */
function estimateSentiment(text: string): number {
  const lower = text.toLowerCase();

  const negativeWords = [
    'angry', 'furious', 'terrible', 'horrible', 'worst', 'hate',
    'disappointed', 'frustrat', 'unacceptable', 'awful', 'disgusting',
    'scam', 'fraud', 'steal', 'cheat', 'lawsuit', 'sue', 'never again',
    'worst experience', 'rip off', 'waste of money',
  ];

  const positiveWords = [
    'thank', 'great', 'excellent', 'wonderful', 'perfect', 'amazing',
    'awesome', 'love', 'appreciate', 'helpful', 'fantastic', 'best',
    'happy', 'satisfied', 'pleased', 'good job', 'well done',
  ];

  let score = 0;
  for (const word of negativeWords) {
    if (lower.includes(word)) score -= 0.3;
  }
  for (const word of positiveWords) {
    if (lower.includes(word)) score += 0.3;
  }

  return Math.max(-1, Math.min(1, score));
}

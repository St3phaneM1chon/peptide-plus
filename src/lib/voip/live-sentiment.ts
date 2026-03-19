/**
 * Live Sentiment Analysis — Real-time phrase-by-phrase sentiment during calls
 *
 * Buffers incoming transcription text and analyzes sentiment using OpenAI GPT.
 * Provides:
 * - Per-phrase sentiment (positive / negative / neutral) with score (-1 to 1)
 * - Overall call sentiment with trend detection (improving / stable / declining)
 * - Sentiment timeline for post-call visualization
 *
 * Usage:
 *   const analyzer = new LiveSentimentAnalyzer({ minTextLength: 20 });
 *   analyzer.onSentimentUpdate((result) => logger.info(result));
 *   analyzer.feedText('I am very happy with this product.');
 */

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SentimentResult {
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number; // -1 to 1
  confidence: number;
  timestamp: number;
}

export interface SentimentConfig {
  apiKey?: string;
  model?: string;
  minTextLength?: number;
  bufferSize?: number;
}

type SentimentTrend = 'improving' | 'stable' | 'declining';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Required<SentimentConfig> = {
  apiKey: '',
  model: 'gpt-4o-mini',
  minTextLength: 15,
  bufferSize: 5,
};

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

const SENTIMENT_SYSTEM_PROMPT = `You are a real-time sentiment analyzer for customer service calls.
Analyze the given text and return a JSON object with:
- "sentiment": "positive", "negative", or "neutral"
- "score": number from -1.0 (very negative) to 1.0 (very positive), 0.0 = neutral
- "confidence": number from 0.0 to 1.0

Consider tone, word choice, and context. Be precise.
Respond ONLY with valid JSON, no markdown fences.`;

// ---------------------------------------------------------------------------
// LiveSentimentAnalyzer
// ---------------------------------------------------------------------------

export class LiveSentimentAnalyzer {
  private buffer: string = '';
  private results: SentimentResult[] = [];
  private onSentimentCallback?: (result: SentimentResult) => void;
  private config: Required<SentimentConfig>;
  private analyzing = false;

  constructor(config?: SentimentConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      apiKey: config?.apiKey || process.env.OPENAI_API_KEY || '',
    };
  }

  /**
   * Feed text chunks from transcription.
   * Text is buffered until it reaches minTextLength, then analyzed.
   */
  async feedText(text: string): Promise<void> {
    this.buffer += (this.buffer ? ' ' : '') + text.trim();

    if (this.buffer.length >= this.config.minTextLength && !this.analyzing) {
      const textToAnalyze = this.buffer;
      this.buffer = '';
      this.analyzing = true;

      try {
        const result = await this.analyzeSentiment(textToAnalyze);
        this.results.push(result);

        // Keep buffer bounded
        if (this.results.length > 500) {
          this.results = this.results.slice(-250);
        }

        this.onSentimentCallback?.(result);
      } catch (error) {
        logger.warn('[LiveSentiment] Analysis failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.analyzing = false;
      }
    }
  }

  /**
   * Analyze a text fragment using the OpenAI API.
   */
  private async analyzeSentiment(text: string): Promise<SentimentResult> {
    if (!this.config.apiKey) {
      // Fallback: basic keyword-based sentiment when no API key
      return this.fallbackAnalysis(text);
    }

    try {
      const response = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: SENTIMENT_SYSTEM_PROMPT },
            { role: 'user', content: text },
          ],
          temperature: 0.1,
          max_tokens: 80,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return {
        text,
        sentiment: parsed.sentiment || 'neutral',
        score: Math.max(-1, Math.min(1, parsed.score ?? 0)),
        confidence: Math.max(0, Math.min(1, parsed.confidence ?? 0.5)),
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.debug('[LiveSentiment] API call failed, using fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.fallbackAnalysis(text);
    }
  }

  /**
   * Basic keyword-based sentiment when OpenAI is unavailable.
   */
  private fallbackAnalysis(text: string): SentimentResult {
    const lower = text.toLowerCase();
    const positiveWords = [
      'happy', 'great', 'excellent', 'thank', 'love', 'perfect', 'wonderful',
      'amazing', 'good', 'pleased', 'satisfied', 'appreciate', 'helpful',
      'merci', 'parfait', 'super', 'content', 'satisfait', 'formidable',
    ];
    const negativeWords = [
      'angry', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'unacceptable',
      'frustrated', 'disappointed', 'poor', 'bad', 'complaint', 'cancel',
      'furieux', 'terrible', 'plainte', 'insatisfait', 'inacceptable', 'annuler',
    ];

    let positiveCount = 0;
    let negativeCount = 0;
    for (const w of positiveWords) {
      if (lower.includes(w)) positiveCount++;
    }
    for (const w of negativeWords) {
      if (lower.includes(w)) negativeCount++;
    }

    let sentiment: SentimentResult['sentiment'] = 'neutral';
    let score = 0;
    if (positiveCount > negativeCount) {
      sentiment = 'positive';
      score = Math.min(1, positiveCount * 0.25);
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
      score = Math.max(-1, negativeCount * -0.25);
    }

    return {
      text,
      sentiment,
      score,
      confidence: 0.4,
      timestamp: Date.now(),
    };
  }

  /**
   * Get overall call sentiment with trend detection.
   */
  getOverallSentiment(): { sentiment: string; score: number; trend: SentimentTrend } {
    if (this.results.length === 0) {
      return { sentiment: 'neutral', score: 0, trend: 'stable' };
    }

    const totalScore = this.results.reduce((sum, r) => sum + r.score, 0);
    const avgScore = totalScore / this.results.length;

    let sentiment: string;
    if (avgScore > 0.15) sentiment = 'positive';
    else if (avgScore < -0.15) sentiment = 'negative';
    else sentiment = 'neutral';

    // Trend: compare first half vs second half
    let trend: SentimentTrend = 'stable';
    if (this.results.length >= 4) {
      const mid = Math.floor(this.results.length / 2);
      const firstHalf = this.results.slice(0, mid);
      const secondHalf = this.results.slice(mid);

      const firstAvg = firstHalf.reduce((s, r) => s + r.score, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, r) => s + r.score, 0) / secondHalf.length;
      const delta = secondAvg - firstAvg;

      if (delta > 0.15) trend = 'improving';
      else if (delta < -0.15) trend = 'declining';
    }

    return {
      sentiment,
      score: Math.round(avgScore * 100) / 100,
      trend,
    };
  }

  /**
   * Subscribe to sentiment events.
   */
  onSentimentUpdate(callback: (result: SentimentResult) => void): void {
    this.onSentimentCallback = callback;
  }

  /**
   * Get the full sentiment timeline.
   */
  getTimeline(): SentimentResult[] {
    return [...this.results];
  }

  /**
   * Reset all state.
   */
  reset(): void {
    this.buffer = '';
    this.results = [];
    this.analyzing = false;
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Save overall sentiment to CallLog.metadata.
 * If the sentiment is negative, checks for consecutive negative calls from
 * the same client and creates a CrmTask for retention follow-up.
 */
export async function saveSentiment(
  callLogId: string,
  sentiment: ReturnType<LiveSentimentAnalyzer['getOverallSentiment']>
): Promise<void> {
  try {
    const { prisma } = await import('@/lib/db');

    const callLog = await prisma.callLog.findUnique({
      where: { id: callLogId },
      select: { metadata: true, clientId: true, callerNumber: true },
    });

    const existingMetadata = (callLog?.metadata as Record<string, unknown>) || {};

    await prisma.callLog.update({
      where: { id: callLogId },
      data: {
        metadata: {
          ...existingMetadata,
          sentiment: {
            overall: sentiment.sentiment,
            score: sentiment.score,
            trend: sentiment.trend,
            analyzedAt: new Date().toISOString(),
          },
        },
      },
    });

    logger.info('[Sentiment] Saved to CallLog', {
      callLogId,
      overall: sentiment.sentiment,
      score: sentiment.score,
    });

    // ── Retention alert: 2+ consecutive negative calls from same client ──
    if (sentiment.sentiment === 'negative' && callLog?.clientId) {
      await checkNegativeSentimentRetention(prisma, callLogId, callLog.clientId);
    }
  } catch (error) {
    logger.error('[Sentiment] Failed to save', {
      callLogId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Check if the previous call from the same client also had negative sentiment.
 * If so, create a CrmTask "Appeler pour retention" with HIGH priority.
 */
async function checkNegativeSentimentRetention(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any,
  currentCallLogId: string,
  clientId: string
): Promise<void> {
  try {
    // Find the most recent *other* call from this client that has sentiment data
    const previousCalls = await prisma.callLog.findMany({
      where: {
        clientId,
        id: { not: currentCallLogId },
        metadata: { not: null },
      },
      orderBy: { startedAt: 'desc' },
      take: 1,
      select: { id: true, metadata: true },
    });

    if (previousCalls.length === 0) return;

    const prevMeta = previousCalls[0].metadata as Record<string, unknown> | null;
    const prevSentiment = prevMeta?.sentiment as { overall?: string } | undefined;

    if (prevSentiment?.overall !== 'negative') return;

    // Two consecutive negative calls — check if a retention task already exists recently
    const existingTask = await prisma.crmTask.findFirst({
      where: {
        contactId: clientId,
        title: { contains: 'rétention' },
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });

    if (existingTask) {
      logger.debug('[Sentiment] Retention task already exists', {
        clientId,
        taskId: existingTask.id,
      });
      return;
    }

    // Find a default assignee (first admin or the client's most recent agent)
    const recentAgentCall = await prisma.callLog.findFirst({
      where: { clientId, agentId: { not: null } },
      orderBy: { startedAt: 'desc' },
      select: { agent: { select: { userId: true } } },
    });

    let assigneeId = recentAgentCall?.agent?.userId;

    if (!assigneeId) {
      // Fallback: first admin user
      const admin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true },
      });
      assigneeId = admin?.id;
    }

    if (!assigneeId) {
      logger.warn('[Sentiment] No assignee found for retention task', { clientId });
      return;
    }

    await prisma.crmTask.create({
      data: {
        title: 'Appeler pour rétention — sentiment négatif consécutif',
        description:
          `Le client a eu 2 appels consécutifs avec un sentiment négatif. ` +
          `Dernier appel: ${currentCallLogId}. Action de rétention recommandée.`,
        type: 'CALL',
        priority: 'HIGH',
        status: 'PENDING',
        contactId: clientId,
        assignedToId: assigneeId,
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Due in 24h
      },
    });

    logger.info('[Sentiment] Retention CrmTask created', {
      clientId,
      reason: '2 consecutive negative sentiment calls',
    });
  } catch (error) {
    // Non-blocking — don't fail the call flow for retention logic
    logger.error('[Sentiment] Failed to check/create retention task', {
      clientId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

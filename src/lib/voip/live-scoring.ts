/**
 * AI Live Call Scoring — Real-time call quality scoring during live calls
 *
 * Scores agent performance across configurable criteria using GPT analysis:
 * - Greeting quality
 * - Empathy and active listening
 * - Problem resolution effectiveness
 * - Compliance with scripts/policies
 * - Professionalism
 * - Closing quality
 *
 * Updates scores periodically during the call and provides a final scorecard
 * with improvement recommendations.
 *
 * Usage:
 *   const scorer = new LiveCallScorer({ updateInterval: 30 });
 *   scorer.onScore((score) => updateUI(score));
 *   scorer.feedTranscript('Hello, how can I help you?', 'agent');
 */

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreCategory {
  name: string;
  score: number; // 0-100
  weight: number;
  details: string;
}

export interface LiveScore {
  overall: number; // 0-100
  categories: ScoreCategory[];
  timestamp: number;
  callDuration: number;
}

export interface ScoringConfig {
  apiKey?: string;
  criteria?: string[];
  weights?: Record<string, number>;
  updateInterval?: number; // seconds between GPT scoring calls
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CRITERIA = [
  'greeting',
  'empathy',
  'resolution',
  'compliance',
  'professionalism',
  'closing',
];

const DEFAULT_WEIGHTS: Record<string, number> = {
  greeting: 10,
  empathy: 20,
  resolution: 25,
  compliance: 20,
  professionalism: 15,
  closing: 10,
};

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

const SCORING_SYSTEM_PROMPT = `You are a call quality scoring engine for a customer service center.
Score the provided call transcript on these criteria. Return a JSON object with a "categories" array.

Each category object must have:
- "name": the criterion name (exactly as provided)
- "score": 0-100 integer
- "details": brief explanation (1 sentence)

Scoring guidelines:
- greeting (0-100): Did the agent greet professionally with name/company? Opening warmth?
- empathy (0-100): Active listening, acknowledging feelings, using empathetic language?
- resolution (0-100): Did the agent address the issue? Provide clear solutions? Follow through?
- compliance (0-100): Script adherence, proper disclosures, regulatory compliance?
- professionalism (0-100): Tone, language, patience, no interrupting, respectful?
- closing (0-100): Proper summary, next steps, thank the customer, anything else?

If the call is still in progress and a criterion hasn't been observed yet, score it 50 with details "Not yet observed".
Respond ONLY with valid JSON, no markdown fences.`;

// ---------------------------------------------------------------------------
// LiveCallScorer
// ---------------------------------------------------------------------------

export class LiveCallScorer {
  private transcriptBuffer: Array<{ text: string; speaker: 'agent' | 'customer' }> = [];
  private currentScore: LiveScore | null = null;
  private history: LiveScore[] = [];
  private onScoreCallback?: (score: LiveScore) => void;
  private config: Required<ScoringConfig>;
  private startTime: number = 0;
  private lastScoringTime: number = 0;
  private scoring = false;

  constructor(config?: ScoringConfig) {
    this.config = {
      apiKey: config?.apiKey || process.env.OPENAI_API_KEY || '',
      criteria: config?.criteria || DEFAULT_CRITERIA,
      weights: config?.weights || DEFAULT_WEIGHTS,
      updateInterval: config?.updateInterval || 30,
    };
  }

  /**
   * Feed transcript text for scoring.
   * Triggers a scoring update if enough time has elapsed since the last one.
   */
  async feedTranscript(text: string, speaker: 'agent' | 'customer'): Promise<void> {
    if (this.startTime === 0) {
      this.startTime = Date.now();
    }

    this.transcriptBuffer.push({ text, speaker });

    // Check if we should trigger a scoring update
    const now = Date.now();
    const elapsed = (now - this.lastScoringTime) / 1000;

    if (elapsed >= this.config.updateInterval && !this.scoring) {
      this.scoring = true;
      try {
        const score = await this.calculateScore();
        this.currentScore = score;
        this.history.push(score);
        this.lastScoringTime = now;
        this.onScoreCallback?.(score);
      } catch (error) {
        logger.warn('[LiveScoring] Score calculation failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.scoring = false;
      }
    }
  }

  /**
   * Calculate current score using GPT analysis.
   */
  private async calculateScore(): Promise<LiveScore> {
    const callDuration = (Date.now() - this.startTime) / 1000;

    if (!this.config.apiKey) {
      return this.fallbackScore(callDuration);
    }

    // Build transcript text from buffer
    const transcriptText = this.transcriptBuffer
      .map((entry) => `[${entry.speaker.toUpperCase()}]: ${entry.text}`)
      .join('\n');

    try {
      const criteriaList = this.config.criteria.join(', ');

      const response = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SCORING_SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Score this call on: ${criteriaList}\n\nTranscript:\n${transcriptText}`,
            },
          ],
          temperature: 0.2,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      const categories: ScoreCategory[] = (parsed.categories || []).map(
        (cat: Record<string, unknown>) => {
          const name = String(cat.name || 'unknown');
          return {
            name,
            score: Math.max(0, Math.min(100, Number(cat.score) || 50)),
            weight: this.config.weights[name] || 10,
            details: String(cat.details || ''),
          };
        }
      );

      // Ensure all criteria are represented
      for (const criterion of this.config.criteria) {
        if (!categories.find((c) => c.name === criterion)) {
          categories.push({
            name: criterion,
            score: 50,
            weight: this.config.weights[criterion] || 10,
            details: 'Not yet observed',
          });
        }
      }

      // Calculate weighted overall
      const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);
      const weightedSum = categories.reduce((sum, c) => sum + c.score * c.weight, 0);
      const overall = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

      return {
        overall,
        categories,
        timestamp: Date.now(),
        callDuration,
      };
    } catch (error) {
      logger.debug('[LiveScoring] GPT scoring failed, using fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.fallbackScore(callDuration);
    }
  }

  /**
   * Basic fallback scoring when OpenAI is unavailable.
   */
  private fallbackScore(callDuration: number): LiveScore {
    const agentMessages = this.transcriptBuffer.filter((e) => e.speaker === 'agent');
    const allText = agentMessages.map((e) => e.text).join(' ').toLowerCase();

    const categories: ScoreCategory[] = this.config.criteria.map((name) => {
      let score = 50;
      let details = 'Automated estimate (API unavailable)';

      if (name === 'greeting' && agentMessages.length > 0) {
        const first = agentMessages[0].text.toLowerCase();
        if (first.includes('bonjour') || first.includes('hello') || first.includes('hi')) {
          score = 75;
          details = 'Greeting detected in opening';
        }
      } else if (name === 'empathy') {
        const empathyWords = ['understand', 'comprends', 'sorry', 'desole', 'appreciate'];
        const count = empathyWords.filter((w) => allText.includes(w)).length;
        score = Math.min(100, 40 + count * 15);
        details = `${count} empathy indicator(s) detected`;
      } else if (name === 'professionalism') {
        const professionalWords = ['please', 'thank', 'merci', 'monsieur', 'madame'];
        const count = professionalWords.filter((w) => allText.includes(w)).length;
        score = Math.min(100, 40 + count * 12);
        details = `${count} professionalism indicator(s) detected`;
      }

      return {
        name,
        score,
        weight: this.config.weights[name] || 10,
        details,
      };
    });

    const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);
    const weightedSum = categories.reduce((sum, c) => sum + c.score * c.weight, 0);
    const overall = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 50;

    return { overall, categories, timestamp: Date.now(), callDuration };
  }

  /**
   * Get the most recent score.
   */
  getCurrentScore(): LiveScore | null {
    return this.currentScore;
  }

  /**
   * Get all historical scores from this call.
   */
  getScoreHistory(): LiveScore[] {
    return [...this.history];
  }

  /**
   * Subscribe to score updates.
   */
  onScore(callback: (score: LiveScore) => void): void {
    this.onScoreCallback = callback;
  }

  /**
   * Get final scorecard with summary and improvement recommendations.
   */
  async getFinalScorecard(): Promise<{
    score: LiveScore;
    summary: string;
    improvements: string[];
  }> {
    // Force a final scoring calculation
    this.scoring = true;
    try {
      const finalScore = await this.calculateScore();
      this.currentScore = finalScore;
      this.history.push(finalScore);

      // Generate improvement recommendations
      const improvements: string[] = [];
      const sorted = [...finalScore.categories].sort((a, b) => a.score - b.score);

      for (const cat of sorted.slice(0, 3)) {
        if (cat.score < 70) {
          improvements.push(`Improve ${cat.name}: ${cat.details}`);
        }
      }

      // Build summary
      const qualityLabel =
        finalScore.overall >= 85
          ? 'Excellent'
          : finalScore.overall >= 70
            ? 'Good'
            : finalScore.overall >= 50
              ? 'Needs improvement'
              : 'Below expectations';

      const durationMin = Math.round(finalScore.callDuration / 60);
      const summary = `Call scored ${finalScore.overall}/100 (${qualityLabel}). Duration: ${durationMin}min. ${
        improvements.length > 0
          ? `${improvements.length} area(s) for improvement identified.`
          : 'All criteria met expectations.'
      }`;

      return { score: finalScore, summary, improvements };
    } finally {
      this.scoring = false;
    }
  }

  /**
   * Reset all state for a new call.
   */
  reset(): void {
    this.transcriptBuffer = [];
    this.currentScore = null;
    this.history = [];
    this.startTime = 0;
    this.lastScoringTime = 0;
    this.scoring = false;
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Save the final scorecard to the database.
 * Called at the end of a call to persist quality scores in CallLog.metadata.
 */
export async function saveScorecard(
  callLogId: string,
  scorecard: Awaited<ReturnType<LiveCallScorer['getFinalScorecard']>>
): Promise<void> {
  try {
    const { prisma } = await import('@/lib/db');

    const callLog = await prisma.callLog.findUnique({
      where: { id: callLogId },
      select: { metadata: true },
    });

    const existingMetadata = (callLog?.metadata as Record<string, unknown>) || {};

    await prisma.callLog.update({
      where: { id: callLogId },
      data: {
        metadata: {
          ...existingMetadata,
          qualityScore: {
            overall: scorecard.score.overall,
            categories: scorecard.score.categories.map((c) => ({
              name: c.name,
              score: c.score,
              weight: c.weight,
              details: c.details,
            })),
            callDuration: scorecard.score.callDuration,
            summary: scorecard.summary,
            improvements: scorecard.improvements,
            scoredAt: new Date().toISOString(),
          },
        },
      },
    });

    logger.info('[LiveScoring] Scorecard saved', {
      callLogId,
      overall: scorecard.score.overall,
    });
  } catch (error) {
    logger.error('[LiveScoring] Failed to save scorecard', {
      callLogId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

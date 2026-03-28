/**
 * AI COACHING / AGENT ASSIST
 * Real-time suggestions during calls, post-call coaching, and agent scoring.
 * Uses OpenAI for AI-powered insights (lazy-initialized).
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Lazy OpenAI client
// ---------------------------------------------------------------------------

let _openai: ReturnType<typeof require> | null = null;

function getOpenAI(): { chat: { completions: { create: (params: Record<string, unknown>) => Promise<{ choices?: { message?: { content?: string } }[] }> } } } {
  if (_openai) return _openai;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set');
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { default: OpenAI } = require('openai');
  _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// ---------------------------------------------------------------------------
// Real-time suggestions
// ---------------------------------------------------------------------------

/**
 * Generate real-time AI suggestions based on the current call transcript.
 * Provides objection handling tips, product information, and next-step recommendations.
 */
export async function getRealtimeSuggestions(
  transcript: string,
  dealContext?: { value?: number | string; stage?: string; products?: string },
): Promise<string[]> {
  if (!transcript.trim()) {
    return [];
  }

  try {
    const openai = getOpenAI();

    const contextInfo = dealContext
      ? `\n\nDeal Context:\n- Deal Value: ${dealContext.value || 'unknown'}\n- Stage: ${dealContext.stage || 'unknown'}\n- Products: ${dealContext.products || 'unknown'}`
      : '';

    const completion = await openai.chat.completions.create({
      model: process.env.COACHING_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a real-time sales coaching assistant for Attitudes VIP, a research peptide supplier. ' +
            'Based on the call transcript provided, generate 2-4 concise suggestions for the agent. ' +
            'Focus on:\n' +
            '1. Objection handling (if the customer raises concerns)\n' +
            '2. Product knowledge tips (relevant peptide information)\n' +
            '3. Next best action (what to say or do next)\n' +
            '4. Closing techniques (if appropriate)\n\n' +
            'Respond with a JSON array of strings, each being a short actionable suggestion (max 100 chars each). ' +
            'No other text or explanation.' +
            contextInfo,
        },
        {
          role: 'user',
          content: `Current call transcript:\n${transcript.slice(0, 3000)}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.5,
    });

    const responseText = completion.choices?.[0]?.message?.content?.trim();
    if (!responseText) return [];

    const suggestions = JSON.parse(responseText);
    return Array.isArray(suggestions)
      ? suggestions.filter((s: unknown) => typeof s === 'string').slice(0, 5)
      : [];
  } catch (error) {
    logger.error('[Coaching] Real-time suggestions failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return fallbackSuggestions(transcript);
  }
}

// ---------------------------------------------------------------------------
// Post-call coaching
// ---------------------------------------------------------------------------

/**
 * Generate post-call coaching feedback for an agent.
 * Analyzes the call summary and returns strengths, improvements, and tips.
 * Also stores the coaching as a CrmActivity.
 */
export async function generatePostCallCoaching(
  callSummary: string,
  agentId: string,
): Promise<{
  strengths: string[];
  improvements: string[];
  tips: string[];
}> {
  try {
    const openai = getOpenAI();

    const completion = await openai.chat.completions.create({
      model: process.env.COACHING_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a sales coaching AI for Attitudes VIP. Analyze the call summary and provide coaching feedback. ' +
            'Respond ONLY with a JSON object containing exactly three fields:\n' +
            '- "strengths": array of 2-3 things the agent did well\n' +
            '- "improvements": array of 2-3 areas for improvement\n' +
            '- "tips": array of 2-3 actionable tips for next calls\n' +
            'Each item should be a concise string (max 150 chars). No other text.',
        },
        {
          role: 'user',
          content: `Call Summary:\n${callSummary.slice(0, 3000)}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const responseText = completion.choices?.[0]?.message?.content?.trim();
    if (!responseText) {
      return { strengths: [], improvements: [], tips: [] };
    }

    const parsed = JSON.parse(responseText);
    const result = {
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5) : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 5) : [],
      tips: Array.isArray(parsed.tips) ? parsed.tips.slice(0, 5) : [],
    };

    // Store coaching as CRM activity
    await prisma.crmActivity.create({
      data: {
        type: 'NOTE',
        title: 'AI Post-Call Coaching',
        description: `Strengths: ${result.strengths.join('; ')}. Improvements: ${result.improvements.join('; ')}`,
        performedById: agentId,
        metadata: {
          coachingType: 'post_call',
          strengths: result.strengths,
          improvements: result.improvements,
          tips: result.tips,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    logger.info('[Coaching] Post-call coaching generated', { agentId });

    return result;
  } catch (error) {
    logger.error('[Coaching] Post-call coaching failed', {
      agentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      strengths: ['Call completed successfully'],
      improvements: ['Consider asking more open-ended questions'],
      tips: ['Review product knowledge before next call'],
    };
  }
}

// ---------------------------------------------------------------------------
// Coaching history
// ---------------------------------------------------------------------------

/**
 * Retrieve past coaching sessions for an agent from CRM activity metadata.
 */
export async function getCoachingHistory(
  agentId: string,
  limit: number,
): Promise<
  {
    date: string;
    strengths: string[];
    improvements: string[];
  }[]
> {
  const activities = await prisma.crmActivity.findMany({
    where: {
      performedById: agentId,
      type: 'NOTE',
      metadata: {
        path: ['coachingType'],
        equals: 'post_call',
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      createdAt: true,
      metadata: true,
    },
  });

  return activities.map((activity) => {
    const metadata = activity.metadata as Record<string, unknown> | null;
    return {
      date: activity.createdAt.toISOString().split('T')[0],
      strengths: Array.isArray(metadata?.strengths) ? metadata.strengths : [],
      improvements: Array.isArray(metadata?.improvements) ? metadata.improvements : [],
    };
  });
}

// ---------------------------------------------------------------------------
// Agent coaching score
// ---------------------------------------------------------------------------

/**
 * Calculate an agent's coaching score (0-100) based on recent QA scores
 * and sentiment data from CRM activities.
 */
export async function getAgentCoachingScore(
  agentId: string,
): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get recent activities with QA or sentiment data
  const activities = await prisma.crmActivity.findMany({
    where: {
      performedById: agentId,
      createdAt: { gte: thirtyDaysAgo },
    },
    select: {
      metadata: true,
      type: true,
    },
  });

  if (activities.length === 0) {
    return 50; // Default neutral score
  }

  let sentimentSum = 0;
  let sentimentCount = 0;
  let qaSum = 0;
  let qaCount = 0;
  let coachingCount = 0;
  let improvementCount = 0;

  for (const activity of activities) {
    const metadata = activity.metadata as Record<string, unknown> | null;
    if (!metadata) continue;

    // Sentiment scores
    if (typeof metadata.sentimentScore === 'number') {
      sentimentSum += metadata.sentimentScore;
      sentimentCount++;
    }

    // QA scores
    if (typeof metadata.qaScore === 'number') {
      qaSum += metadata.qaScore;
      qaCount++;
    }

    // Coaching sessions (more coaching = agent is working on improvement)
    if (metadata.coachingType === 'post_call') {
      coachingCount++;
      const improvements = metadata.improvements;
      if (Array.isArray(improvements)) {
        improvementCount += improvements.length;
      }
    }
  }

  // Calculate components (0-100 each)
  let score = 50; // Base score

  // Sentiment component (40% weight)
  if (sentimentCount > 0) {
    const avgSentiment = sentimentSum / sentimentCount;
    // Map -1..1 to 0..100
    const sentimentScore = (avgSentiment + 1) * 50;
    score = score * 0.6 + sentimentScore * 0.4;
  }

  // QA component (30% weight)
  if (qaCount > 0) {
    const avgQa = qaSum / qaCount;
    score = score * 0.7 + avgQa * 0.3;
  }

  // Activity volume bonus (up to 10 points)
  const activityBonus = Math.min(10, activities.length * 0.5);
  score += activityBonus;

  // Coaching engagement bonus (up to 5 points)
  const coachingBonus = Math.min(5, coachingCount * 1.5);
  score += coachingBonus;

  // Improvement areas penalty (slight reduction if many improvements needed)
  const improvementPenalty = Math.min(10, improvementCount * 0.5);
  score -= improvementPenalty;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ---------------------------------------------------------------------------
// Fallback suggestions (no AI)
// ---------------------------------------------------------------------------

function fallbackSuggestions(transcript: string): string[] {
  const lower = transcript.toLowerCase();
  const suggestions: string[] = [];

  if (lower.includes('price') || lower.includes('cost') || lower.includes('expensive')) {
    suggestions.push('Highlight value proposition and bulk pricing options');
  }
  if (lower.includes('competitor') || lower.includes('other supplier')) {
    suggestions.push('Emphasize our purity standards and fast shipping');
  }
  if (lower.includes('when') || lower.includes('delivery') || lower.includes('ship')) {
    suggestions.push('Confirm shipping timeline: 1-2 days processing, 3-5 days delivery');
  }
  if (lower.includes('quality') || lower.includes('purity') || lower.includes('test')) {
    suggestions.push('Mention our HPLC testing and Certificate of Analysis included');
  }

  if (suggestions.length === 0) {
    suggestions.push('Ask about their research needs to identify the right products');
    suggestions.push('Mention our volume discount program for research institutions');
  }

  return suggestions;
}

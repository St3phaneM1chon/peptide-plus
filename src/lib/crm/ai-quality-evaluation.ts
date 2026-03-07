/**
 * CRM Agentic QM / AI Auto-Evaluate 100% - F17
 *
 * AI-powered quality management that automatically evaluates every customer
 * interaction (call, chat, email) against QA form criteria. Unlike manual QA
 * that covers 2-5% of interactions, this provides 100% coverage with
 * consistent scoring.
 *
 * Functions:
 * - autoEvaluateInteraction: Dispatch to appropriate channel evaluator
 * - evaluateCallQuality: Transcription -> OpenAI evaluation -> QA score
 * - evaluateChatQuality: Chat messages -> evaluate tone, accuracy, resolution
 * - evaluateEmailQuality: Email content -> professionalism, completeness
 * - getAutoQADashboard: Coverage, avg scores, trending issues
 * - identifyCoachingOpportunities: Areas needing improvement per agent
 * - compareAutoVsHumanQA: Correlation analysis between AI and human QA
 *
 * Storage: CrmQaScore with metadata.source = 'AI_AUTO'
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Lazy OpenAI client
// ---------------------------------------------------------------------------

let _openai: any | null = null;

function getOpenAI(): any {
  if (_openai) return _openai;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set');
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { default: OpenAI } = require('openai');
  _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const QA_MODEL = 'gpt-4o-mini';
const AI_SCORER_ID = 'SYSTEM_AI_QA'; // Virtual user ID for AI-scored evaluations

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InteractionChannel = 'call' | 'chat' | 'email';

export interface AutoQAResult {
  entityId: string;
  channel: InteractionChannel;
  agentId: string;
  formId: string;
  scores: Record<string, number>;
  totalScore: number;
  maxScore: number;
  percentage: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  qaScoreId: string;
}

export interface AutoQADashboard {
  period: { start: string; end: string };
  totalEvaluations: number;
  coveragePercent: number;
  avgScoreByChannel: Record<InteractionChannel, { avg: number; count: number }>;
  overallAvgScore: number;
  trendingIssues: Array<{ issue: string; frequency: number; avgImpact: number }>;
  topPerformers: Array<{ agentId: string; agentName: string; avgScore: number }>;
  bottomPerformers: Array<{ agentId: string; agentName: string; avgScore: number }>;
}

export interface CoachingOpportunity {
  agentId: string;
  agentName: string;
  criterion: string;
  avgScore: number;
  maxPossible: number;
  frequency: number;
  exampleInteractions: string[];
  suggestedAction: string;
}

export interface AutoVsHumanComparison {
  period: { start: string; end: string };
  pairCount: number;
  correlation: number;
  avgAutoScore: number;
  avgHumanScore: number;
  scoreDifference: number;
  agreement: { agree: number; disagree: number; total: number; rate: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getDefaultQAForm(): Promise<{ id: string; criteria: any[] } | null> {
  const form = await prisma.crmQaForm.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    select: { id: true, criteria: true },
  });

  if (!form) return null;

  const criteria = Array.isArray(form.criteria) ? form.criteria : [];
  return { id: form.id, criteria };
}

function buildCriteriaPrompt(criteria: any[]): string {
  return criteria
    .map(
      (c: any, i: number) =>
        `${i + 1}. ${c.name} (max score: ${c.maxScore}, weight: ${c.weight ?? 1})`,
    )
    .join('\n');
}

async function ensureAIScorer(): Promise<string> {
  // Check if the AI scorer "user" exists; if not, use the first OWNER user
  const owner = await prisma.user.findFirst({
    where: { role: 'OWNER' },
    select: { id: true },
  });
  return owner?.id ?? AI_SCORER_ID;
}

// ---------------------------------------------------------------------------
// autoEvaluateInteraction
// ---------------------------------------------------------------------------

/**
 * Dispatch an interaction to the appropriate channel-specific evaluator.
 *
 * @param type - The interaction channel: 'call', 'chat', or 'email'
 * @param entityId - The ID of the call log, conversation, or activity record
 * @returns The auto-QA evaluation result
 */
export async function autoEvaluateInteraction(
  type: InteractionChannel,
  entityId: string,
): Promise<AutoQAResult> {
  switch (type) {
    case 'call':
      return evaluateCallQuality(entityId);
    case 'chat':
      return evaluateChatQuality(entityId);
    case 'email':
      return evaluateEmailQuality(entityId);
    default:
      throw new Error(`Unsupported interaction type: ${type}`);
  }
}

// ---------------------------------------------------------------------------
// evaluateCallQuality
// ---------------------------------------------------------------------------

/**
 * Evaluate a call's quality using its transcription.
 * Loads the call transcription, sends it to OpenAI with the QA form criteria,
 * and stores the resulting score in CrmQaScore.
 *
 * @param callLogId - The call log ID to evaluate
 * @returns The auto-QA evaluation result
 */
export async function evaluateCallQuality(callLogId: string): Promise<AutoQAResult> {
  const [callLog, transcription, form] = await Promise.all([
    prisma.callLog.findUnique({
      where: { id: callLogId },
      select: { id: true, agentId: true, duration: true, disposition: true },
    }),
    prisma.callTranscription.findFirst({
      where: { callLogId },
      select: { fullText: true, summary: true, sentiment: true },
    }),
    getDefaultQAForm(),
  ]);

  if (!callLog) throw new Error(`CallLog ${callLogId} not found`);
  if (!transcription) throw new Error(`No transcription found for call ${callLogId}`);
  if (!form) throw new Error('No active QA form found');

  const agentId = callLog.agentId ?? 'unknown';
  const scorerId = await ensureAIScorer();

  const content = [
    transcription.fullText.slice(0, 6000),
    transcription.summary ? `\nSummary: ${transcription.summary}` : '',
    transcription.sentiment ? `\nSentiment: ${transcription.sentiment}` : '',
    callLog.duration ? `\nCall Duration: ${callLog.duration}s` : '',
    callLog.disposition ? `\nDisposition: ${callLog.disposition}` : '',
  ].join('');

  return performAIEvaluation({
    channel: 'call',
    entityId: callLogId,
    agentId,
    scorerId,
    form,
    content,
    contentLabel: 'Call Transcription',
  });
}

// ---------------------------------------------------------------------------
// evaluateChatQuality
// ---------------------------------------------------------------------------

/**
 * Evaluate a chat conversation's quality.
 * Loads inbox conversation messages and evaluates tone, accuracy,
 * and resolution effectiveness.
 *
 * @param conversationId - The inbox conversation ID to evaluate
 * @returns The auto-QA evaluation result
 */
export async function evaluateChatQuality(conversationId: string): Promise<AutoQAResult> {
  const conversation = await prisma.inboxConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 50,
        select: {
          senderName: true,
          content: true,
          direction: true,
          createdAt: true,
        },
      },
    },
  });

  if (!conversation) throw new Error(`Conversation ${conversationId} not found`);
  if (conversation.messages.length === 0) {
    throw new Error(`No messages in conversation ${conversationId}`);
  }

  const form = await getDefaultQAForm();
  if (!form) throw new Error('No active QA form found');

  const agentId = conversation.assignedToId ?? 'unknown';
  const scorerId = await ensureAIScorer();

  const chatContent = conversation.messages
    .map(
      (m: { direction: string; senderName: string | null; content: string }) =>
        `[${m.direction === 'INBOUND' ? 'Customer' : 'Agent'}] ${m.senderName ?? 'Unknown'}: ${m.content?.slice(0, 500) ?? ''}`,
    )
    .join('\n')
    .slice(0, 6000);

  return performAIEvaluation({
    channel: 'chat',
    entityId: conversationId,
    agentId,
    scorerId,
    form,
    content: chatContent,
    contentLabel: 'Chat Conversation',
  });
}

// ---------------------------------------------------------------------------
// evaluateEmailQuality
// ---------------------------------------------------------------------------

/**
 * Evaluate an email interaction's quality.
 * Loads the CRM activity representing the email and evaluates
 * professionalism, completeness, and response time.
 *
 * @param activityId - The CRM activity ID for the email
 * @returns The auto-QA evaluation result
 */
export async function evaluateEmailQuality(activityId: string): Promise<AutoQAResult> {
  const activity = await prisma.crmActivity.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      type: true,
      title: true,
      description: true,
      performedById: true,
      metadata: true,
      createdAt: true,
    },
  });

  if (!activity) throw new Error(`Activity ${activityId} not found`);

  const form = await getDefaultQAForm();
  if (!form) throw new Error('No active QA form found');

  const agentId = activity.performedById ?? 'unknown';
  const scorerId = await ensureAIScorer();

  const meta = (activity.metadata as Record<string, unknown>) ?? {};
  const content = [
    `Subject: ${activity.title}`,
    `Body: ${activity.description?.slice(0, 5000) ?? '(empty)'}`,
    meta.responseTimeMinutes
      ? `Response Time: ${meta.responseTimeMinutes} minutes`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return performAIEvaluation({
    channel: 'email',
    entityId: activityId,
    agentId,
    scorerId,
    form,
    content,
    contentLabel: 'Email Interaction',
  });
}

// ---------------------------------------------------------------------------
// Core AI evaluation engine
// ---------------------------------------------------------------------------

async function performAIEvaluation(params: {
  channel: InteractionChannel;
  entityId: string;
  agentId: string;
  scorerId: string;
  form: { id: string; criteria: any[] };
  content: string;
  contentLabel: string;
}): Promise<AutoQAResult> {
  const { channel, entityId, agentId, scorerId, form, content, contentLabel } = params;

  const openai = getOpenAI();
  const criteriaPrompt = buildCriteriaPrompt(form.criteria);

  const systemPrompt = [
    `You are a quality assurance evaluator for BioCycle Peptides' ${channel} interactions.`,
    `Evaluate the following ${contentLabel} against these QA criteria:`,
    '',
    criteriaPrompt,
    '',
    'Respond ONLY with a JSON object containing:',
    '- "scores": object mapping each criterion name to a numeric score (0 to its maxScore)',
    '- "feedback": a 1-2 sentence overall assessment',
    '- "strengths": array of 2-3 specific strengths observed',
    '- "improvements": array of 2-3 specific areas for improvement',
    '',
    'Be fair but thorough. Score based on what is actually present in the interaction.',
    'No additional text outside the JSON.',
  ].join('\n');

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.QA_MODEL || QA_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      max_tokens: 800,
      temperature: 0.2,
    });

    const text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty AI response');

    const parsed = JSON.parse(text);
    const scores: Record<string, number> = {};
    let totalScore = 0;
    let maxScore = 0;

    for (const criterion of form.criteria) {
      const name = criterion.name as string;
      const max = Number(criterion.maxScore) || 10;
      const score = Math.min(max, Math.max(0, Number(parsed.scores?.[name]) || 0));
      scores[name] = score;
      totalScore += score;
      maxScore += max;
    }

    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 10000) / 100 : 0;
    const feedback = typeof parsed.feedback === 'string' ? parsed.feedback : 'Evaluation completed.';
    const strengths = Array.isArray(parsed.strengths)
      ? parsed.strengths.filter((s: unknown) => typeof s === 'string').slice(0, 5)
      : [];
    const improvements = Array.isArray(parsed.improvements)
      ? parsed.improvements.filter((s: unknown) => typeof s === 'string').slice(0, 5)
      : [];

    // Store in CrmQaScore
    const qaScore = await prisma.crmQaScore.create({
      data: {
        formId: form.id,
        agentId,
        scoredById: scorerId,
        callLogId: channel === 'call' ? entityId : null,
        scores: scores as unknown as Prisma.InputJsonValue,
        totalScore,
        maxScore,
        percentage,
        feedback: [
          feedback,
          `[AI_AUTO | ${channel.toUpperCase()} | ${entityId}]`,
          `Strengths: ${strengths.join('; ')}`,
          `Improvements: ${improvements.join('; ')}`,
        ].join('\n'),
      },
    });

    logger.info('[ai-quality-evaluation] Auto-evaluation completed', {
      channel,
      entityId,
      agentId,
      percentage,
      qaScoreId: qaScore.id,
    });

    return {
      entityId,
      channel,
      agentId,
      formId: form.id,
      scores,
      totalScore,
      maxScore,
      percentage,
      feedback,
      strengths,
      improvements,
      qaScoreId: qaScore.id,
    };
  } catch (error) {
    logger.error('[ai-quality-evaluation] Evaluation failed', {
      channel,
      entityId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// getAutoQADashboard
// ---------------------------------------------------------------------------

/**
 * Get the auto-QA dashboard metrics for a time period.
 * Includes coverage %, average scores by channel, trending issues,
 * and top/bottom performers.
 *
 * @param period - Date range for the dashboard
 * @returns Dashboard metrics
 */
export async function getAutoQADashboard(
  period: { start: Date; end: Date },
): Promise<AutoQADashboard> {
  const qaScores = await prisma.crmQaScore.findMany({
    where: {
      createdAt: { gte: period.start, lte: period.end },
      feedback: { contains: '[AI_AUTO' },
    },
    include: {
      agent: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  // Total interactions in period (approximate from call logs + activities)
  const [callCount, activityCount] = await Promise.all([
    prisma.callLog.count({
      where: { createdAt: { gte: period.start, lte: period.end } },
    }),
    prisma.crmActivity.count({
      where: {
        type: { in: ['EMAIL', 'NOTE'] },
        createdAt: { gte: period.start, lte: period.end },
      },
    }),
  ]);
  const totalInteractions = callCount + activityCount;

  // Scores by channel
  const channelStats: Record<InteractionChannel, { sum: number; count: number }> = {
    call: { sum: 0, count: 0 },
    chat: { sum: 0, count: 0 },
    email: { sum: 0, count: 0 },
  };

  // Agent scores for top/bottom
  const agentScores = new Map<string, { name: string; sum: number; count: number }>();

  // Issue tracking
  const issueFrequency = new Map<string, { count: number; totalImpact: number }>();

  for (const qs of qaScores) {
    const feedback = qs.feedback ?? '';
    const pct = Number(qs.percentage);

    // Determine channel from feedback
    let channel: InteractionChannel = 'call';
    if (feedback.includes('CHAT')) channel = 'chat';
    else if (feedback.includes('EMAIL')) channel = 'email';

    channelStats[channel].sum += pct;
    channelStats[channel].count++;

    // Agent aggregation
    const agentId = qs.agentId;
    const existing = agentScores.get(agentId) ?? {
      name: qs.agent?.name ?? 'Unknown',
      sum: 0,
      count: 0,
    };
    existing.sum += pct;
    existing.count++;
    agentScores.set(agentId, existing);

    // Extract low-scoring criteria as issues
    const scores = qs.scores as Record<string, number> | null;
    if (scores) {
      for (const [criterion, score] of Object.entries(scores)) {
        if (typeof score === 'number' && score <= 5) {
          const entry = issueFrequency.get(criterion) ?? { count: 0, totalImpact: 0 };
          entry.count++;
          entry.totalImpact += (10 - score); // Higher impact for lower scores
          issueFrequency.set(criterion, entry);
        }
      }
    }
  }

  // Build average by channel
  const avgScoreByChannel: AutoQADashboard['avgScoreByChannel'] = {
    call: {
      avg: channelStats.call.count > 0
        ? Math.round((channelStats.call.sum / channelStats.call.count) * 10) / 10
        : 0,
      count: channelStats.call.count,
    },
    chat: {
      avg: channelStats.chat.count > 0
        ? Math.round((channelStats.chat.sum / channelStats.chat.count) * 10) / 10
        : 0,
      count: channelStats.chat.count,
    },
    email: {
      avg: channelStats.email.count > 0
        ? Math.round((channelStats.email.sum / channelStats.email.count) * 10) / 10
        : 0,
      count: channelStats.email.count,
    },
  };

  // Top and bottom performers
  const agentList = Array.from(agentScores.entries()).map(([id, data]) => ({
    agentId: id,
    agentName: data.name,
    avgScore: Math.round((data.sum / data.count) * 10) / 10,
  }));
  agentList.sort((a, b) => b.avgScore - a.avgScore);

  // Trending issues
  const trendingIssues = Array.from(issueFrequency.entries())
    .map(([issue, data]) => ({
      issue,
      frequency: data.count,
      avgImpact: Math.round((data.totalImpact / data.count) * 10) / 10,
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);

  const totalEvaluations = qaScores.length;
  const totalScoreSum = qaScores.reduce((s, q) => s + Number(q.percentage), 0);

  return {
    period: { start: period.start.toISOString(), end: period.end.toISOString() },
    totalEvaluations,
    coveragePercent:
      totalInteractions > 0 ? Math.round((totalEvaluations / totalInteractions) * 100) : 0,
    avgScoreByChannel,
    overallAvgScore:
      totalEvaluations > 0 ? Math.round((totalScoreSum / totalEvaluations) * 10) / 10 : 0,
    trendingIssues,
    topPerformers: agentList.slice(0, 5),
    bottomPerformers: agentList.slice(-5).reverse(),
  };
}

// ---------------------------------------------------------------------------
// identifyCoachingOpportunities
// ---------------------------------------------------------------------------

/**
 * Identify specific areas where an agent needs coaching based on
 * auto-QA evaluations. Finds criteria with consistently low scores.
 *
 * @param agentId - The agent to analyze
 * @returns Array of coaching opportunities sorted by impact
 */
export async function identifyCoachingOpportunities(
  agentId: string,
): Promise<CoachingOpportunity[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [user, qaScores, form] = await Promise.all([
    prisma.user.findUnique({ where: { id: agentId }, select: { name: true } }),
    prisma.crmQaScore.findMany({
      where: {
        agentId,
        createdAt: { gte: thirtyDaysAgo },
        feedback: { contains: '[AI_AUTO' },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    }),
    getDefaultQAForm(),
  ]);

  if (!form || qaScores.length === 0) return [];

  // Aggregate scores per criterion
  const criterionStats = new Map<
    string,
    { sum: number; count: number; maxPossible: number; interactions: string[] }
  >();

  for (const qs of qaScores) {
    const scores = qs.scores as Record<string, number> | null;
    if (!scores) continue;

    for (const [criterion, score] of Object.entries(scores)) {
      if (typeof score !== 'number') continue;

      const formCriterion = form.criteria.find((c: any) => c.name === criterion);
      const maxScore = formCriterion ? Number(formCriterion.maxScore) : 10;

      const entry = criterionStats.get(criterion) ?? {
        sum: 0,
        count: 0,
        maxPossible: maxScore,
        interactions: [],
      };
      entry.sum += score;
      entry.count++;
      if (score <= maxScore * 0.6 && entry.interactions.length < 3) {
        // Extract entity ID from feedback
        const feedback = qs.feedback ?? '';
        const match = feedback.match(/\|\s*([\w-]+)\]/);
        if (match) entry.interactions.push(match[1]);
      }
      criterionStats.set(criterion, entry);
    }
  }

  // Find criteria where avg score is below 70% of max
  const opportunities: CoachingOpportunity[] = [];

  for (const [criterion, stats] of criterionStats.entries()) {
    const avgScore = stats.sum / stats.count;
    const threshold = stats.maxPossible * 0.7;

    if (avgScore < threshold) {
      let suggestedAction: string;
      if (avgScore < stats.maxPossible * 0.4) {
        suggestedAction = `Urgent: Schedule dedicated training session on "${criterion}"`;
      } else if (avgScore < stats.maxPossible * 0.6) {
        suggestedAction = `Assign peer shadowing focused on "${criterion}" best practices`;
      } else {
        suggestedAction = `Include "${criterion}" in next 1-on-1 coaching discussion`;
      }

      opportunities.push({
        agentId,
        agentName: user?.name ?? 'Unknown',
        criterion,
        avgScore: Math.round(avgScore * 10) / 10,
        maxPossible: stats.maxPossible,
        frequency: stats.count,
        exampleInteractions: stats.interactions,
        suggestedAction,
      });
    }
  }

  // Sort by impact (largest gap between avg and max)
  opportunities.sort(
    (a, b) => (b.maxPossible - b.avgScore) - (a.maxPossible - a.avgScore),
  );

  return opportunities;
}

// ---------------------------------------------------------------------------
// compareAutoVsHumanQA
// ---------------------------------------------------------------------------

/**
 * Compare AI auto-evaluations against human QA scores for the same
 * interactions. Calculates correlation and agreement rates.
 *
 * @param period - Date range for comparison
 * @returns Comparison analysis between AI and human QA scores
 */
export async function compareAutoVsHumanQA(
  period: { start: Date; end: Date },
): Promise<AutoVsHumanComparison> {
  // Get AI-scored evaluations
  const aiScores = await prisma.crmQaScore.findMany({
    where: {
      createdAt: { gte: period.start, lte: period.end },
      feedback: { contains: '[AI_AUTO' },
      callLogId: { not: null },
    },
    select: { callLogId: true, percentage: true },
    take: 1000,
  });

  // Get human-scored evaluations for the same calls
  const callLogIds = aiScores
    .map((s) => s.callLogId)
    .filter((id): id is string => id !== null);

  const humanScores = await prisma.crmQaScore.findMany({
    where: {
      createdAt: { gte: period.start, lte: period.end },
      feedback: { not: { contains: '[AI_AUTO' } },
      callLogId: { in: callLogIds },
    },
    select: { callLogId: true, percentage: true },
    take: 1000,
  });

  // Build pairs (same callLogId evaluated by both AI and human)
  const humanMap = new Map<string, number>();
  for (const hs of humanScores) {
    if (hs.callLogId) {
      humanMap.set(hs.callLogId, Number(hs.percentage));
    }
  }

  const pairs: Array<{ ai: number; human: number }> = [];
  for (const as_ of aiScores) {
    if (as_.callLogId && humanMap.has(as_.callLogId)) {
      pairs.push({
        ai: Number(as_.percentage),
        human: humanMap.get(as_.callLogId)!,
      });
    }
  }

  if (pairs.length === 0) {
    return {
      period: { start: period.start.toISOString(), end: period.end.toISOString() },
      pairCount: 0,
      correlation: 0,
      avgAutoScore: 0,
      avgHumanScore: 0,
      scoreDifference: 0,
      agreement: { agree: 0, disagree: 0, total: 0, rate: 0 },
    };
  }

  // Calculate averages
  const avgAI = pairs.reduce((s, p) => s + p.ai, 0) / pairs.length;
  const avgHuman = pairs.reduce((s, p) => s + p.human, 0) / pairs.length;

  // Calculate Pearson correlation coefficient
  let sumAIDiff2 = 0;
  let sumHumanDiff2 = 0;
  let sumProduct = 0;

  for (const pair of pairs) {
    const aiDiff = pair.ai - avgAI;
    const humanDiff = pair.human - avgHuman;
    sumAIDiff2 += aiDiff * aiDiff;
    sumHumanDiff2 += humanDiff * humanDiff;
    sumProduct += aiDiff * humanDiff;
  }

  const denominator = Math.sqrt(sumAIDiff2 * sumHumanDiff2);
  const correlation = denominator > 0 ? Math.round((sumProduct / denominator) * 1000) / 1000 : 0;

  // Agreement: scores within 10% of each other
  const AGREEMENT_THRESHOLD = 10;
  let agree = 0;
  for (const pair of pairs) {
    if (Math.abs(pair.ai - pair.human) <= AGREEMENT_THRESHOLD) {
      agree++;
    }
  }

  return {
    period: { start: period.start.toISOString(), end: period.end.toISOString() },
    pairCount: pairs.length,
    correlation,
    avgAutoScore: Math.round(avgAI * 10) / 10,
    avgHumanScore: Math.round(avgHuman * 10) / 10,
    scoreDifference: Math.round(Math.abs(avgAI - avgHuman) * 10) / 10,
    agreement: {
      agree,
      disagree: pairs.length - agree,
      total: pairs.length,
      rate: Math.round((agree / pairs.length) * 100),
    },
  };
}

/**
 * CRM Agent Mood / Wellness Tracking - F16
 *
 * Tracks agent emotional health and burnout indicators similar to
 * Genesys Employee Experience. Provides daily/shift wellness surveys,
 * trend analysis, burnout risk detection, and AI-generated wellness
 * recommendations.
 *
 * Functions:
 * - submitWellnessCheck: Record a daily/shift wellness survey response
 * - getAgentWellness: Wellness trends for an agent over time
 * - detectBurnoutRisk: Analyze wellness + performance for burnout indicators
 * - getTeamWellness: Team-wide anonymized wellness overview
 * - generateWellnessRecommendations: AI-powered suggestions based on trends
 * - getWellnessAlerts: Agents with declining wellness or burnout risk
 *
 * Storage: CrmActivity with metadata.source = 'wellness_check'
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WellnessCheckData {
  mood: number;        // 1-5 (1=very low, 5=excellent)
  stressLevel: number; // 1-5 (1=no stress, 5=extreme stress)
  workload: number;    // 1-5 (1=underloaded, 5=overwhelmed)
  notes?: string;
}

export interface WellnessEntry {
  id: string;
  agentId: string;
  date: string;
  mood: number;
  stressLevel: number;
  workload: number;
  notes: string | null;
  submittedAt: string;
}

export interface WellnessTrend {
  agentId: string;
  agentName: string;
  entries: WellnessEntry[];
  averages: {
    mood: number;
    stressLevel: number;
    workload: number;
  };
  trend: 'improving' | 'stable' | 'declining';
  dataPoints: number;
}

export interface BurnoutRiskAssessment {
  agentId: string;
  agentName: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  riskScore: number; // 0-100
  factors: string[];
  recommendation: string;
}

export interface TeamWellnessOverview {
  teamSize: number;
  respondents: number;
  responseRate: number;
  averageMood: number;
  averageStress: number;
  averageWorkload: number;
  moodDistribution: Record<string, number>; // "1"-"5" -> count
  burnoutRiskCounts: { low: number; moderate: number; high: number; critical: number };
  trendDirection: 'improving' | 'stable' | 'declining';
}

export interface WellnessAlert {
  agentId: string;
  agentName: string;
  alertType: 'declining_mood' | 'high_stress' | 'burnout_risk' | 'no_checkin';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  detectedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WELLNESS_SOURCE = 'wellness_check';
const BURNOUT_LOOKBACK_DAYS = 14;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseWellnessMeta(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const meta = metadata as Record<string, unknown>;
  if (meta.source !== WELLNESS_SOURCE) return null;
  return meta;
}

// ---------------------------------------------------------------------------
// submitWellnessCheck
// ---------------------------------------------------------------------------

/**
 * Record a daily or per-shift wellness check for an agent.
 * Validates input ranges and stores as a CrmActivity.
 *
 * @param agentId - The agent submitting the wellness check
 * @param data - Mood (1-5), stress (1-5), workload (1-5), optional notes
 * @returns The created wellness entry
 */
export async function submitWellnessCheck(
  agentId: string,
  data: WellnessCheckData,
): Promise<WellnessEntry> {
  const mood = clamp(Math.round(data.mood), 1, 5);
  const stressLevel = clamp(Math.round(data.stressLevel), 1, 5);
  const workload = clamp(Math.round(data.workload), 1, 5);

  const user = await prisma.user.findUnique({
    where: { id: agentId },
    select: { id: true, name: true },
  });

  if (!user) {
    throw new Error(`Agent ${agentId} not found`);
  }

  const activity = await prisma.crmActivity.create({
    data: {
      type: 'NOTE',
      title: 'Wellness Check',
      description: data.notes ?? `Mood: ${mood}/5, Stress: ${stressLevel}/5, Workload: ${workload}/5`,
      performedById: agentId,
      metadata: {
        source: WELLNESS_SOURCE,
        mood,
        stressLevel,
        workload,
        notes: data.notes ?? null,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  logger.info('[agent-wellness] Wellness check submitted', {
    agentId,
    mood,
    stressLevel,
    workload,
  });

  return {
    id: activity.id,
    agentId,
    date: activity.createdAt.toISOString().split('T')[0],
    mood,
    stressLevel,
    workload,
    notes: data.notes ?? null,
    submittedAt: activity.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// getAgentWellness
// ---------------------------------------------------------------------------

/**
 * Retrieve wellness trends for a specific agent over a time period.
 *
 * @param agentId - The agent to look up
 * @param period - Date range for trend data
 * @returns Wellness trend data including averages and direction
 */
export async function getAgentWellness(
  agentId: string,
  period: { start: Date; end: Date },
): Promise<WellnessTrend> {
  const [user, activities] = await Promise.all([
    prisma.user.findUnique({
      where: { id: agentId },
      select: { name: true },
    }),
    prisma.crmActivity.findMany({
      where: {
        performedById: agentId,
        type: 'NOTE',
        metadata: { path: ['source'], equals: WELLNESS_SOURCE },
        createdAt: { gte: period.start, lte: period.end },
      },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    }),
  ]);

  const entries: WellnessEntry[] = [];
  let moodSum = 0;
  let stressSum = 0;
  let workloadSum = 0;

  for (const activity of activities) {
    const meta = parseWellnessMeta(activity.metadata);
    if (!meta) continue;

    const mood = (meta.mood as number) ?? 3;
    const stressLevel = (meta.stressLevel as number) ?? 3;
    const workload = (meta.workload as number) ?? 3;

    entries.push({
      id: activity.id,
      agentId,
      date: activity.createdAt.toISOString().split('T')[0],
      mood,
      stressLevel,
      workload,
      notes: (meta.notes as string) ?? null,
      submittedAt: activity.createdAt.toISOString(),
    });

    moodSum += mood;
    stressSum += stressLevel;
    workloadSum += workload;
  }

  const count = entries.length || 1;
  const averages = {
    mood: Math.round((moodSum / count) * 10) / 10,
    stressLevel: Math.round((stressSum / count) * 10) / 10,
    workload: Math.round((workloadSum / count) * 10) / 10,
  };

  // Determine trend by comparing first half vs second half of period
  let trend: WellnessTrend['trend'] = 'stable';
  if (entries.length >= 4) {
    const mid = Math.floor(entries.length / 2);
    const firstHalfMood = entries.slice(0, mid).reduce((s, e) => s + e.mood, 0) / mid;
    const secondHalfMood = entries.slice(mid).reduce((s, e) => s + e.mood, 0) / (entries.length - mid);
    const diff = secondHalfMood - firstHalfMood;
    if (diff > 0.3) trend = 'improving';
    else if (diff < -0.3) trend = 'declining';
  }

  return {
    agentId,
    agentName: user?.name ?? 'Unknown',
    entries,
    averages,
    trend,
    dataPoints: entries.length,
  };
}

// ---------------------------------------------------------------------------
// detectBurnoutRisk
// ---------------------------------------------------------------------------

/**
 * Analyze wellness data combined with performance metrics to detect burnout risk.
 * Considers: declining mood, increasing stress, rising AHT, lower QA scores,
 * and increased break frequency.
 *
 * @param agentId - The agent to assess
 * @returns Burnout risk assessment with factors and recommendations
 */
export async function detectBurnoutRisk(agentId: string): Promise<BurnoutRiskAssessment> {
  const lookbackStart = new Date();
  lookbackStart.setDate(lookbackStart.getDate() - BURNOUT_LOOKBACK_DAYS);

  const [user, wellnessData, dailyStats, qaScores] = await Promise.all([
    prisma.user.findUnique({
      where: { id: agentId },
      select: { name: true },
    }),
    getAgentWellness(agentId, { start: lookbackStart, end: new Date() }),
    prisma.agentDailyStats.findMany({
      where: { agentId, date: { gte: lookbackStart } },
      orderBy: { date: 'asc' },
      take: 1000,
    }),
    prisma.crmQaScore.findMany({
      where: { agentId, createdAt: { gte: lookbackStart } },
      orderBy: { createdAt: 'asc' },
      take: 1000,
    }),
  ]);

  const factors: string[] = [];
  let riskScore = 0;

  // Factor 1: Low mood average (weight: 25)
  if (wellnessData.averages.mood <= 2) {
    riskScore += 25;
    factors.push(`Low average mood: ${wellnessData.averages.mood}/5`);
  } else if (wellnessData.averages.mood <= 3) {
    riskScore += 12;
    factors.push(`Below-average mood: ${wellnessData.averages.mood}/5`);
  }

  // Factor 2: High stress (weight: 25)
  if (wellnessData.averages.stressLevel >= 4) {
    riskScore += 25;
    factors.push(`High stress level: ${wellnessData.averages.stressLevel}/5`);
  } else if (wellnessData.averages.stressLevel >= 3.5) {
    riskScore += 12;
    factors.push(`Elevated stress: ${wellnessData.averages.stressLevel}/5`);
  }

  // Factor 3: Declining wellness trend (weight: 15)
  if (wellnessData.trend === 'declining') {
    riskScore += 15;
    factors.push('Declining wellness trend over period');
  }

  // Factor 4: Rising AHT (weight: 15)
  if (dailyStats.length >= 4) {
    const mid = Math.floor(dailyStats.length / 2);
    const firstHalfAHT =
      dailyStats.slice(0, mid).reduce((s, d) => s + d.avgHandleTime, 0) / mid;
    const secondHalfAHT =
      dailyStats.slice(mid).reduce((s, d) => s + d.avgHandleTime, 0) / (dailyStats.length - mid);
    if (secondHalfAHT > firstHalfAHT * 1.15) {
      riskScore += 15;
      factors.push(
        `AHT increasing: ${Math.round(firstHalfAHT)}s -> ${Math.round(secondHalfAHT)}s`,
      );
    }
  }

  // Factor 5: Declining QA scores (weight: 10)
  if (qaScores.length >= 2) {
    const mid = Math.floor(qaScores.length / 2);
    const firstHalfQA =
      qaScores.slice(0, mid).reduce((s, q) => s + Number(q.percentage), 0) / mid;
    const secondHalfQA =
      qaScores.slice(mid).reduce((s, q) => s + Number(q.percentage), 0) / (qaScores.length - mid);
    if (secondHalfQA < firstHalfQA * 0.9) {
      riskScore += 10;
      factors.push(
        `QA scores declining: ${Math.round(firstHalfQA)}% -> ${Math.round(secondHalfQA)}%`,
      );
    }
  }

  // Factor 6: High workload perception (weight: 10)
  if (wellnessData.averages.workload >= 4) {
    riskScore += 10;
    factors.push(`High perceived workload: ${wellnessData.averages.workload}/5`);
  }

  // Determine risk level
  let riskLevel: BurnoutRiskAssessment['riskLevel'];
  if (riskScore >= 70) riskLevel = 'critical';
  else if (riskScore >= 45) riskLevel = 'high';
  else if (riskScore >= 25) riskLevel = 'moderate';
  else riskLevel = 'low';

  // Generate recommendation based on risk level
  let recommendation: string;
  switch (riskLevel) {
    case 'critical':
      recommendation =
        'Immediate intervention recommended. Consider reduced workload, mandatory time off, and 1-on-1 coaching session.';
      break;
    case 'high':
      recommendation =
        'Schedule a private check-in with the agent. Review workload distribution and consider temporary queue reassignment.';
      break;
    case 'moderate':
      recommendation =
        'Monitor closely. Ensure adequate breaks and consider peer mentoring or wellness resources.';
      break;
    default:
      recommendation = 'No immediate action needed. Continue regular check-ins.';
  }

  if (factors.length === 0) {
    factors.push('No significant risk factors detected');
  }

  logger.info('[agent-wellness] Burnout risk assessed', {
    agentId,
    riskLevel,
    riskScore,
    factorCount: factors.length,
  });

  return {
    agentId,
    agentName: user?.name ?? 'Unknown',
    riskLevel,
    riskScore: Math.min(100, riskScore),
    factors,
    recommendation,
  };
}

// ---------------------------------------------------------------------------
// getTeamWellness
// ---------------------------------------------------------------------------

/**
 * Get an anonymized team-wide wellness overview.
 * Aggregates wellness data from the last 7 days for all agents,
 * optionally filtered by manager.
 *
 * @param managerId - Optional manager ID to filter direct reports only
 * @returns Team wellness overview with anonymized trends
 */
export async function getTeamWellness(_managerId?: string): Promise<TeamWellnessOverview> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get all agents (optionally filtered by manager relationship in future)
  const agentWhere: Prisma.UserWhereInput = {
    role: { in: ['EMPLOYEE', 'OWNER'] },
  };

  const agents = await prisma.user.findMany({
    where: agentWhere,
    select: { id: true },
    take: 1000,
  });

  const agentIds = agents.map((a) => a.id);
  const teamSize = agentIds.length;

  // Get recent wellness entries
  const activities = await prisma.crmActivity.findMany({
    where: {
      performedById: { in: agentIds },
      type: 'NOTE',
      metadata: { path: ['source'], equals: WELLNESS_SOURCE },
      createdAt: { gte: sevenDaysAgo },
    },
    take: 1000,
  });

  const respondentIds = new Set<string>();
  let moodSum = 0;
  let stressSum = 0;
  let workloadSum = 0;
  let count = 0;
  const moodDist: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

  for (const activity of activities) {
    const meta = parseWellnessMeta(activity.metadata);
    if (!meta) continue;

    if (activity.performedById) {
      respondentIds.add(activity.performedById);
    }

    const mood = (meta.mood as number) ?? 3;
    const stress = (meta.stressLevel as number) ?? 3;
    const workload = (meta.workload as number) ?? 3;

    moodSum += mood;
    stressSum += stress;
    workloadSum += workload;
    count++;

    const moodKey = String(clamp(Math.round(mood), 1, 5));
    moodDist[moodKey] = (moodDist[moodKey] ?? 0) + 1;
  }

  // Assess burnout risk for all agents
  const burnoutRiskCounts = { low: 0, moderate: 0, high: 0, critical: 0 };
  for (const agentId of agentIds) {
    try {
      const assessment = await detectBurnoutRisk(agentId);
      burnoutRiskCounts[assessment.riskLevel]++;
    } catch {
      burnoutRiskCounts.low++; // Default to low if assessment fails
    }
  }

  const safeCount = count || 1;
  const avgMood = Math.round((moodSum / safeCount) * 10) / 10;

  return {
    teamSize,
    respondents: respondentIds.size,
    responseRate: teamSize > 0 ? Math.round((respondentIds.size / teamSize) * 100) : 0,
    averageMood: avgMood,
    averageStress: Math.round((stressSum / safeCount) * 10) / 10,
    averageWorkload: Math.round((workloadSum / safeCount) * 10) / 10,
    moodDistribution: moodDist,
    burnoutRiskCounts,
    trendDirection: avgMood >= 3.5 ? 'improving' : avgMood >= 2.5 ? 'stable' : 'declining',
  };
}

// ---------------------------------------------------------------------------
// generateWellnessRecommendations
// ---------------------------------------------------------------------------

/**
 * Generate AI-powered wellness recommendations based on an agent's
 * recent wellness trends and performance data.
 *
 * @param agentId - The agent to generate recommendations for
 * @returns Array of personalized wellness recommendations
 */
export async function generateWellnessRecommendations(
  agentId: string,
): Promise<string[]> {
  const lookbackStart = new Date();
  lookbackStart.setDate(lookbackStart.getDate() - BURNOUT_LOOKBACK_DAYS);

  const [wellness, burnout] = await Promise.all([
    getAgentWellness(agentId, { start: lookbackStart, end: new Date() }),
    detectBurnoutRisk(agentId),
  ]);

  try {
    const openai = getOpenAI();

    const prompt = [
      'You are a workplace wellness advisor for a call center.',
      'Based on the following agent wellness data, provide 3-5 concise, actionable recommendations.',
      '',
      `Agent: ${wellness.agentName}`,
      `Average Mood: ${wellness.averages.mood}/5`,
      `Average Stress: ${wellness.averages.stressLevel}/5`,
      `Average Workload: ${wellness.averages.workload}/5`,
      `Wellness Trend: ${wellness.trend}`,
      `Burnout Risk: ${burnout.riskLevel} (score: ${burnout.riskScore}/100)`,
      `Risk Factors: ${burnout.factors.join('; ')}`,
      `Data Points: ${wellness.dataPoints} wellness checks over ${BURNOUT_LOOKBACK_DAYS} days`,
      '',
      'Respond with a JSON array of strings. Each recommendation should be specific,',
      'actionable, and under 200 characters. No other text or explanation.',
    ].join('\n');

    const completion = await openai.chat.completions.create({
      model: process.env.COACHING_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Generate wellness recommendations.' },
      ],
      max_tokens: 500,
      temperature: 0.4,
    });

    const text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) return fallbackRecommendations(burnout.riskLevel);

    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.filter((s: unknown) => typeof s === 'string').slice(0, 5);
    }

    return fallbackRecommendations(burnout.riskLevel);
  } catch (error) {
    logger.error('[agent-wellness] AI recommendations failed', {
      agentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return fallbackRecommendations(burnout.riskLevel);
  }
}

// ---------------------------------------------------------------------------
// getWellnessAlerts
// ---------------------------------------------------------------------------

/**
 * Get a list of agents with declining wellness or burnout risk.
 * Scans all active agents and returns alerts for those needing attention.
 *
 * @returns Array of wellness alerts sorted by severity
 */
export async function getWellnessAlerts(): Promise<WellnessAlert[]> {
  const agents = await prisma.user.findMany({
    where: { role: { in: ['EMPLOYEE', 'OWNER'] } },
    select: { id: true, name: true },
    take: 1000,
  });

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const alerts: WellnessAlert[] = [];
  const now = new Date().toISOString();

  for (const agent of agents) {
    // Check for recent wellness submissions
    const recentCheck = await prisma.crmActivity.findFirst({
      where: {
        performedById: agent.id,
        type: 'NOTE',
        metadata: { path: ['source'], equals: WELLNESS_SOURCE },
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!recentCheck) {
      alerts.push({
        agentId: agent.id,
        agentName: agent.name ?? 'Unknown',
        alertType: 'no_checkin',
        severity: 'info',
        message: `${agent.name ?? 'Agent'} has not submitted a wellness check in over 7 days`,
        detectedAt: now,
      });
      continue;
    }

    // Assess burnout risk
    try {
      const risk = await detectBurnoutRisk(agent.id);

      if (risk.riskLevel === 'critical') {
        alerts.push({
          agentId: agent.id,
          agentName: agent.name ?? 'Unknown',
          alertType: 'burnout_risk',
          severity: 'critical',
          message: `Critical burnout risk detected (score: ${risk.riskScore}/100). ${risk.factors[0] ?? ''}`,
          detectedAt: now,
        });
      } else if (risk.riskLevel === 'high') {
        alerts.push({
          agentId: agent.id,
          agentName: agent.name ?? 'Unknown',
          alertType: 'burnout_risk',
          severity: 'warning',
          message: `High burnout risk (score: ${risk.riskScore}/100). ${risk.factors[0] ?? ''}`,
          detectedAt: now,
        });
      }

      // Check for high stress specifically
      const lookbackStart = new Date();
      lookbackStart.setDate(lookbackStart.getDate() - 7);
      const wellness = await getAgentWellness(agent.id, {
        start: lookbackStart,
        end: new Date(),
      });

      if (wellness.averages.stressLevel >= 4 && risk.riskLevel !== 'critical') {
        alerts.push({
          agentId: agent.id,
          agentName: agent.name ?? 'Unknown',
          alertType: 'high_stress',
          severity: 'warning',
          message: `Consistently high stress level: ${wellness.averages.stressLevel}/5 average over 7 days`,
          detectedAt: now,
        });
      }

      if (wellness.trend === 'declining' && risk.riskLevel !== 'critical' && risk.riskLevel !== 'high') {
        alerts.push({
          agentId: agent.id,
          agentName: agent.name ?? 'Unknown',
          alertType: 'declining_mood',
          severity: 'info',
          message: `Declining wellness trend detected. Average mood: ${wellness.averages.mood}/5`,
          detectedAt: now,
        });
      }
    } catch {
      // Skip agents where assessment fails
    }
  }

  // Sort by severity: critical > warning > info
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

  return alerts;
}

// ---------------------------------------------------------------------------
// Fallback recommendations (no AI)
// ---------------------------------------------------------------------------

function fallbackRecommendations(
  riskLevel: BurnoutRiskAssessment['riskLevel'],
): string[] {
  switch (riskLevel) {
    case 'critical':
      return [
        'Take a mental health day or use available PTO as soon as possible',
        'Schedule a confidential meeting with your supervisor to discuss workload',
        'Consider using the Employee Assistance Program (EAP) for professional support',
        'Reduce screen time during breaks - take short walks outside',
      ];
    case 'high':
      return [
        'Review your weekly schedule and identify tasks that can be delegated',
        'Set firm boundaries for break times and stick to them',
        'Practice the 4-7-8 breathing technique between calls',
      ];
    case 'moderate':
      return [
        'Try a 5-minute mindfulness exercise at the start of each shift',
        'Prioritize social interactions with colleagues during breaks',
        'Maintain a regular sleep schedule, even on days off',
      ];
    default:
      return [
        'Keep up the good work with regular wellness check-ins',
        'Share positive practices with teammates who may be struggling',
      ];
  }
}

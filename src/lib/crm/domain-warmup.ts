/**
 * CRM Email Domain Warm-up Tools (H11)
 *
 * Gradually increase email sending volume for new domains to build sender
 * reputation and avoid spam filters. Similar to HubSpot's domain warm-up
 * and Mailgun's IP warm-up features.
 *
 * Warm-up plan:
 * - Starts at 10 emails/day
 * - Doubles every 2-3 days based on deliverability metrics
 * - Monitors bounce rate, complaint rate, open rate
 * - AI recommendations based on deliverability signals
 *
 * Warm-up data stored in AuditTrail config store (entityType: DOMAIN_WARMUP).
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Lazy OpenAI client (for recommendations)
// ---------------------------------------------------------------------------

type OpenAIClient = import('openai').default;

let _openai: OpenAIClient | null = null;

function getOpenAI(): OpenAIClient {
  if (_openai) return _openai;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured');
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { default: OpenAI } = require('openai');
  // Security: pass key by reference, never log or expose it
  const client: OpenAIClient = new OpenAI({ apiKey });
  _openai = client;
  return client;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WarmupPlanConfig {
  targetVolume: number;    // target daily emails at full warm-up
  durationDays: number;    // total warm-up duration
  startDate: Date;
}

export interface WarmupPlan {
  domain: string;
  targetVolume: number;
  durationDays: number;
  startDate: string;
  schedule: WarmupDaySchedule[];
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  createdAt: string;
}

export interface WarmupDaySchedule {
  day: number;
  date: string;
  dailyLimit: number;
  cumulativeTarget: number;
}

export interface WarmupProgress {
  domain: string;
  currentDay: number;
  totalDays: number;
  todayLimit: number;
  todaySent: number;
  overallSent: number;
  deliverabilityRate: number;
  bounceRate: number;
  openRate: number;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  healthIndicator: 'excellent' | 'good' | 'warning' | 'critical';
}

export interface WarmupDayMetrics {
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  complaints?: number;
}

export interface WarmupRecommendation {
  type: 'increase' | 'decrease' | 'pause' | 'continue' | 'resume';
  reason: string;
  suggestedVolume?: number;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/[^a-z0-9.-]/g, '');
}

async function getWarmupData(domain: string): Promise<WarmupPlan | null> {
  try {
    const trail = await prisma.auditTrail.findFirst({
      where: { entityType: 'DOMAIN_WARMUP', entityId: sanitizeDomain(domain), action: 'CONFIG' },
      orderBy: { createdAt: 'desc' },
      // Security: select only metadata - avoid exposing userId or other audit fields
      select: { metadata: true },
    });
    if (!trail?.metadata) return null;
    const config = trail.metadata as Record<string, unknown>;
    return config as unknown as WarmupPlan;
  } catch (error) {
    logger.warn('[Domain-Warmup] Failed to load warmup data', {
      domain,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function saveWarmupData(domain: string, data: WarmupPlan): Promise<void> {
  await prisma.auditTrail.create({
    data: {
      entityType: 'DOMAIN_WARMUP',
      entityId: sanitizeDomain(domain),
      action: 'CONFIG',
      metadata: data as unknown as Prisma.InputJsonValue,
      userId: 'system',
    },
  });
}

/**
 * Generate a warm-up schedule with exponential volume increase.
 * Starts at 10/day, roughly doubles every 2-3 days until target volume.
 */
function generateSchedule(
  config: WarmupPlanConfig,
  startDate: Date,
): WarmupDaySchedule[] {
  const schedule: WarmupDaySchedule[] = [];
  const { targetVolume, durationDays } = config;

  // Calculate daily multiplier to reach target from 10 in durationDays
  const startVolume = 10;
  const growthRate = Math.pow(targetVolume / startVolume, 1 / durationDays);
  let cumulative = 0;

  for (let day = 1; day <= durationDays; day++) {
    const dailyLimit = Math.min(
      Math.round(startVolume * Math.pow(growthRate, day - 1)),
      targetVolume,
    );
    cumulative += dailyLimit;

    const date = new Date(startDate);
    date.setDate(date.getDate() + day - 1);

    schedule.push({
      day,
      date: date.toISOString().split('T')[0],
      dailyLimit,
      cumulativeTarget: cumulative,
    });
  }

  return schedule;
}

// ---------------------------------------------------------------------------
// createWarmupPlan
// ---------------------------------------------------------------------------

/**
 * Create a new domain warm-up plan with a progressive volume schedule.
 */
export async function createWarmupPlan(
  domain: string,
  config: WarmupPlanConfig,
): Promise<WarmupPlan> {
  const existing = await getWarmupData(domain);
  if (existing && existing.status === 'active') {
    throw new Error(`Warm-up plan already active for domain ${domain}`);
  }

  if (config.targetVolume < 10) {
    throw new Error('Target volume must be at least 10 emails/day');
  }
  if (config.durationDays < 7) {
    throw new Error('Warm-up duration must be at least 7 days');
  }

  const schedule = generateSchedule(config, config.startDate);

  const plan: WarmupPlan = {
    domain: sanitizeDomain(domain),
    targetVolume: config.targetVolume,
    durationDays: config.durationDays,
    startDate: config.startDate.toISOString(),
    schedule,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  await saveWarmupData(domain, plan);

  logger.info('[Domain-Warmup] Plan created', {
    domain,
    targetVolume: config.targetVolume,
    durationDays: config.durationDays,
  });

  return plan;
}

// ---------------------------------------------------------------------------
// getWarmupSchedule
// ---------------------------------------------------------------------------

/**
 * Get the daily send limits for the warm-up period.
 */
export async function getWarmupSchedule(
  domain: string,
): Promise<WarmupDaySchedule[]> {
  const plan = await getWarmupData(domain);
  if (!plan) throw new Error(`No warm-up plan found for domain ${domain}`);
  return plan.schedule;
}

// ---------------------------------------------------------------------------
// getWarmupProgress
// ---------------------------------------------------------------------------

/**
 * Get current warm-up progress including deliverability metrics.
 */
export async function getWarmupProgress(
  domain: string,
): Promise<WarmupProgress> {
  const plan = await getWarmupData(domain);
  if (!plan) throw new Error(`No warm-up plan found for domain ${domain}`);

  const startDate = new Date(plan.startDate);
  const now = new Date();
  const daysDiff = Math.floor(
    (now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000),
  );
  const currentDay = Math.max(1, Math.min(daysDiff + 1, plan.durationDays));

  const todaySchedule = plan.schedule.find((s) => s.day === currentDay);
  const todayLimit = todaySchedule?.dailyLimit || 0;

  // Get metrics from AuditTrail config store
  // Security: select only metadata to avoid exposing sensitive audit fields
  const metricsTrail = await prisma.auditTrail.findFirst({
    where: { entityType: 'DOMAIN_WARMUP_METRICS', entityId: sanitizeDomain(domain), action: 'CONFIG' },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true },
  });
  const metrics = (metricsTrail?.metadata as unknown as Record<string, WarmupDayMetrics>) || {} as Record<string, WarmupDayMetrics>;

  // Calculate aggregate metrics
  let totalSent = 0;
  let totalDelivered = 0;
  let totalBounced = 0;
  let totalOpened = 0;

  for (const dayMetrics of Object.values(metrics)) {
    totalSent += dayMetrics.sent;
    totalDelivered += dayMetrics.delivered;
    totalBounced += dayMetrics.bounced;
    totalOpened += dayMetrics.opened;
  }

  const todayKey = now.toISOString().split('T')[0];
  const todaySent = metrics[todayKey]?.sent || 0;

  const deliverabilityRate = totalSent > 0
    ? Math.round((totalDelivered / totalSent) * 10000) / 100
    : 100;
  const bounceRate = totalSent > 0
    ? Math.round((totalBounced / totalSent) * 10000) / 100
    : 0;
  const openRate = totalDelivered > 0
    ? Math.round((totalOpened / totalDelivered) * 10000) / 100
    : 0;

  let healthIndicator: WarmupProgress['healthIndicator'] = 'excellent';
  if (bounceRate > 10 || deliverabilityRate < 80) healthIndicator = 'critical';
  else if (bounceRate > 5 || deliverabilityRate < 90) healthIndicator = 'warning';
  else if (bounceRate > 2 || deliverabilityRate < 95) healthIndicator = 'good';

  const status = currentDay >= plan.durationDays ? 'completed' : plan.status;

  return {
    domain: plan.domain,
    currentDay,
    totalDays: plan.durationDays,
    todayLimit,
    todaySent,
    overallSent: totalSent,
    deliverabilityRate,
    bounceRate,
    openRate,
    status,
    healthIndicator,
  };
}

// ---------------------------------------------------------------------------
// updateWarmupMetrics
// ---------------------------------------------------------------------------

/**
 * Log daily warm-up metrics (called by email sending system).
 */
export async function updateWarmupMetrics(
  domain: string,
  metrics: WarmupDayMetrics,
): Promise<void> {
  const plan = await getWarmupData(domain);
  if (!plan) throw new Error(`No warm-up plan found for domain ${domain}`);

  const domainId = sanitizeDomain(domain);
  const todayKey = new Date().toISOString().split('T')[0];

  // Security: select only metadata to avoid exposing sensitive audit fields
  const existingTrail = await prisma.auditTrail.findFirst({
    where: { entityType: 'DOMAIN_WARMUP_METRICS', entityId: domainId, action: 'CONFIG' },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true },
  });
  const allMetrics = (existingTrail?.metadata as unknown as Record<string, WarmupDayMetrics>) || {} as Record<string, WarmupDayMetrics>;

  // Accumulate today's metrics
  const todayMetrics = allMetrics[todayKey] || { sent: 0, delivered: 0, bounced: 0, opened: 0 };
  allMetrics[todayKey] = {
    sent: todayMetrics.sent + metrics.sent,
    delivered: todayMetrics.delivered + metrics.delivered,
    bounced: todayMetrics.bounced + metrics.bounced,
    opened: todayMetrics.opened + metrics.opened,
  };

  await prisma.auditTrail.create({
    data: {
      entityType: 'DOMAIN_WARMUP_METRICS',
      entityId: domainId,
      action: 'CONFIG',
      metadata: allMetrics as unknown as Prisma.InputJsonValue,
      userId: 'system',
    },
  });

  logger.debug('[Domain-Warmup] Metrics updated', { domain, todayKey, metrics });
}

// ---------------------------------------------------------------------------
// shouldThrottle
// ---------------------------------------------------------------------------

/**
 * Check if current send rate exceeds the warm-up daily limit.
 * Returns true if sending should be throttled.
 */
export async function shouldThrottle(domain: string): Promise<boolean> {
  try {
    const progress = await getWarmupProgress(domain);
    if (progress.status !== 'active') return false;
    return progress.todaySent >= progress.todayLimit;
  } catch (error) {
    // No warmup plan = no throttling
    logger.debug('[Domain-Warmup] shouldThrottle check failed (no plan or DB error)', {
      domain,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// ---------------------------------------------------------------------------
// getWarmupRecommendations
// ---------------------------------------------------------------------------

/**
 * Get AI-powered recommendations based on deliverability metrics.
 * Uses OpenAI to analyze trends and suggest adjustments.
 */
export async function getWarmupRecommendations(
  domain: string,
): Promise<WarmupRecommendation[]> {
  const progress = await getWarmupProgress(domain);
  const recommendations: WarmupRecommendation[] = [];

  // Rule-based recommendations
  if (progress.bounceRate > 10) {
    recommendations.push({
      type: 'pause',
      reason: `Bounce rate at ${progress.bounceRate}% exceeds 10% threshold. Pause sending and clean your email list.`,
      confidence: 0.95,
    });
  } else if (progress.bounceRate > 5) {
    recommendations.push({
      type: 'decrease',
      reason: `Bounce rate at ${progress.bounceRate}% is elevated. Reduce daily volume by 50%.`,
      suggestedVolume: Math.floor(progress.todayLimit * 0.5),
      confidence: 0.85,
    });
  }

  if (progress.deliverabilityRate < 80) {
    recommendations.push({
      type: 'pause',
      reason: `Deliverability rate at ${progress.deliverabilityRate}% is critically low. Investigate domain/IP reputation.`,
      confidence: 0.9,
    });
  }

  if (progress.healthIndicator === 'excellent' && progress.openRate > 20) {
    recommendations.push({
      type: 'increase',
      reason: `Excellent deliverability (${progress.deliverabilityRate}%) and good open rate (${progress.openRate}%). Safe to increase volume.`,
      suggestedVolume: Math.min(
        Math.floor(progress.todayLimit * 1.5),
        progress.todayLimit + 100,
      ),
      confidence: 0.8,
    });
  }

  // AI-powered deeper analysis
  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: process.env.ENRICHMENT_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an email deliverability expert. Analyze warm-up metrics and provide ONE recommendation. ' +
            'Return JSON: {"type":"increase|decrease|pause|continue|resume","reason":"explanation","suggestedVolume":number,"confidence":0.0-1.0}',
        },
        {
          role: 'user',
          content: `Domain: ${domain}\nDay: ${progress.currentDay}/${progress.totalDays}\n` +
            `Today limit: ${progress.todayLimit}, sent: ${progress.todaySent}\n` +
            `Deliverability: ${progress.deliverabilityRate}%\nBounce: ${progress.bounceRate}%\n` +
            `Open: ${progress.openRate}%\nHealth: ${progress.healthIndicator}`,
        },
      ],
      max_tokens: 200,
      temperature: 0,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();
    if (raw) {
      const aiRec = JSON.parse(raw) as WarmupRecommendation;
      recommendations.push(aiRec);
    }
  } catch (error) {
    logger.debug('[Domain-Warmup] AI recommendations unavailable', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return recommendations;
}

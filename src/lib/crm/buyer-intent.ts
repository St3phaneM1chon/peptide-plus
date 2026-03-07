/**
 * CRM Buyer Intent Signals (A22)
 *
 * Track web behavior to detect purchase intent.
 * Similar to HubSpot Breeze Intelligence, 6sense, Bombora, G2 Intent.
 *
 * Features:
 * - Track page views with duration and referrer
 * - Track custom intent events (pricing page, demo request, whitepaper)
 * - Calculate intent score from behavior (recency, frequency, page value)
 * - Identify high-intent leads above configurable threshold
 * - Detailed intent signal breakdown per lead
 * - Configurable event weight scoring rules
 *
 * Page views/events stored as CrmActivity with type='NOTE' and
 * intent metadata in the metadata JSON field.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageViewData {
  leadId?: string;
  anonymousId?: string;
  url: string;
  title: string;
  duration: number;    // seconds spent on page
  referrer?: string;
  scrollDepth?: number; // 0-100 percentage
}

export interface IntentEventData {
  leadId?: string;
  anonymousId?: string;
  event: string;
  properties: Record<string, unknown>;
}

export interface IntentScoringRule {
  event: string;
  weight: number;
  decayDays?: number; // Score decays after this many days
}

export interface IntentScore {
  leadId: string;
  score: number;       // 0-100
  level: 'cold' | 'warm' | 'hot' | 'very_hot';
  signals: IntentSignal[];
  lastActivityAt: string;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface IntentSignal {
  event: string;
  count: number;
  lastOccurred: string;
  weight: number;
  contribution: number; // Score points contributed
  details?: string;
}

export interface HighIntentLead {
  leadId: string;
  contactName: string;
  companyName: string | null;
  email: string | null;
  intentScore: number;
  level: IntentScore['level'];
  topSignals: string[];
  lastActivityAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Default intent scoring rules (page weights).
 */
const DEFAULT_SCORING_RULES: IntentScoringRule[] = [
  { event: 'pricing_page_view', weight: 15, decayDays: 7 },
  { event: 'demo_request', weight: 25, decayDays: 14 },
  { event: 'whitepaper_download', weight: 10, decayDays: 14 },
  { event: 'case_study_view', weight: 8, decayDays: 14 },
  { event: 'product_page_view', weight: 5, decayDays: 7 },
  { event: 'blog_view', weight: 2, decayDays: 30 },
  { event: 'contact_page_view', weight: 12, decayDays: 7 },
  { event: 'comparison_page_view', weight: 10, decayDays: 7 },
  { event: 'free_trial_signup', weight: 30, decayDays: 14 },
  { event: 'return_visit', weight: 8, decayDays: 7 },
  { event: 'multiple_page_session', weight: 5, decayDays: 7 },
  { event: 'long_page_view', weight: 6, decayDays: 7 },
];

/**
 * Get scoring rules (from AuditTrail config store or defaults).
 */
async function getScoringRules(): Promise<IntentScoringRule[]> {
  try {
    const trail = await prisma.auditTrail.findFirst({
      where: { entityType: 'INTENT_SCORING_CONFIG', action: 'CONFIG' },
      orderBy: { createdAt: 'desc' },
    });
    if (trail?.metadata) {
      const config = trail.metadata as Record<string, unknown>;
      const rules = config.rules as unknown;
      if (Array.isArray(rules) && rules.length > 0) return rules as IntentScoringRule[];
    }
  } catch {
    // Fall through
  }
  return DEFAULT_SCORING_RULES;
}

/**
 * Classify a page URL into an intent event type.
 */
function classifyPageUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('/pricing') || lower.includes('/plans')) return 'pricing_page_view';
  if (lower.includes('/demo') || lower.includes('/request-demo')) return 'demo_request';
  if (lower.includes('/contact') || lower.includes('/get-started')) return 'contact_page_view';
  if (lower.includes('/case-stud')) return 'case_study_view';
  if (lower.includes('/whitepaper') || lower.includes('/ebook') || lower.includes('/download')) return 'whitepaper_download';
  if (lower.includes('/compare') || lower.includes('/vs-') || lower.includes('/alternative')) return 'comparison_page_view';
  if (lower.includes('/product') || lower.includes('/features')) return 'product_page_view';
  if (lower.includes('/blog') || lower.includes('/article')) return 'blog_view';
  if (lower.includes('/trial') || lower.includes('/signup') || lower.includes('/register')) return 'free_trial_signup';
  return 'page_view';
}

/**
 * Calculate time-based decay factor for a signal.
 */
function decayFactor(signalDate: Date, decayDays: number): number {
  const now = Date.now();
  const ageDays = (now - signalDate.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays <= 0) return 1;
  if (ageDays >= decayDays * 2) return 0;
  return Math.max(0, 1 - ageDays / (decayDays * 2));
}

// ---------------------------------------------------------------------------
// trackPageView
// ---------------------------------------------------------------------------

/**
 * Record a page view as an intent signal.
 * Classifies the page and stores as CrmActivity.
 */
export async function trackPageView(data: PageViewData): Promise<void> {
  if (!data.leadId && !data.anonymousId) {
    logger.warn('[Intent] Page view missing both leadId and anonymousId');
    return;
  }

  const intentEvent = classifyPageUrl(data.url);
  const extraSignals: string[] = [];

  // Detect additional signals
  if (data.duration > 120) extraSignals.push('long_page_view');
  if (data.scrollDepth && data.scrollDepth > 75) extraSignals.push('deep_engagement');

  // Check for return visit
  if (data.leadId) {
    const recentVisit = await prisma.crmActivity.findFirst({
      where: {
        leadId: data.leadId,
        type: 'NOTE',
        metadata: { path: ['intentCategory'], equals: 'page_view' as unknown as Prisma.InputJsonValue },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (recentVisit) extraSignals.push('return_visit');
  }

  // Store as CrmActivity
  await prisma.crmActivity.create({
    data: {
      type: 'NOTE',
      title: `Page view: ${data.title}`,
      description: `Visited ${data.url} for ${data.duration}s`,
      leadId: data.leadId || null,
      metadata: {
        intentCategory: 'page_view',
        intentEvent,
        url: data.url,
        title: data.title,
        duration: data.duration,
        referrer: data.referrer || null,
        scrollDepth: data.scrollDepth || null,
        anonymousId: data.anonymousId || null,
        extraSignals,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  logger.debug('[Intent] Page view tracked', {
    leadId: data.leadId,
    url: data.url,
    intentEvent,
  });
}

// ---------------------------------------------------------------------------
// trackEvent
// ---------------------------------------------------------------------------

/**
 * Record a custom intent event (demo request, whitepaper download, etc.).
 */
export async function trackEvent(data: IntentEventData): Promise<void> {
  if (!data.leadId && !data.anonymousId) {
    logger.warn('[Intent] Event missing both leadId and anonymousId');
    return;
  }

  await prisma.crmActivity.create({
    data: {
      type: 'NOTE',
      title: `Intent: ${data.event}`,
      description: JSON.stringify(data.properties).slice(0, 500),
      leadId: data.leadId || null,
      metadata: {
        intentCategory: 'custom_event',
        intentEvent: data.event,
        properties: data.properties,
        anonymousId: data.anonymousId || null,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  logger.debug('[Intent] Custom event tracked', {
    leadId: data.leadId,
    event: data.event,
  });
}

// ---------------------------------------------------------------------------
// calculateIntentScore
// ---------------------------------------------------------------------------

/**
 * Compute intent score for a lead based on web behavior.
 * Uses recency, frequency, and page value with time-based decay.
 */
export async function calculateIntentScore(leadId: string): Promise<IntentScore> {
  const rules = await getScoringRules();
  const rulesMap = new Map(rules.map((r) => [r.event, r]));

  // Fetch intent activities from last 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const activities = await prisma.crmActivity.findMany({
    where: {
      leadId,
      type: 'NOTE',
      metadata: {
        path: ['intentCategory'],
        not: Prisma.JsonNull,
      },
      createdAt: { gte: ninetyDaysAgo },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Build signal map
  const signalMap = new Map<string, { count: number; lastDate: Date; totalWeight: number }>();

  for (const act of activities) {
    const meta = (act.metadata as Record<string, unknown>) || {};
    const intentEvent = String(meta.intentEvent || 'page_view');
    const rule = rulesMap.get(intentEvent);
    const weight = rule?.weight || 1;
    const decay = rule?.decayDays || 14;

    const existing = signalMap.get(intentEvent) || { count: 0, lastDate: act.createdAt, totalWeight: 0 };
    existing.count++;
    if (act.createdAt > existing.lastDate) existing.lastDate = act.createdAt;
    existing.totalWeight += weight * decayFactor(act.createdAt, decay);
    signalMap.set(intentEvent, existing);

    // Also process extra signals
    const extras = (meta.extraSignals || []) as string[];
    for (const extra of extras) {
      const extraRule = rulesMap.get(extra);
      const extraWeight = extraRule?.weight || 3;
      const extraDecay = extraRule?.decayDays || 7;
      const ext = signalMap.get(extra) || { count: 0, lastDate: act.createdAt, totalWeight: 0 };
      ext.count++;
      if (act.createdAt > ext.lastDate) ext.lastDate = act.createdAt;
      ext.totalWeight += extraWeight * decayFactor(act.createdAt, extraDecay);
      signalMap.set(extra, ext);
    }
  }

  // Calculate total score
  let rawScore = 0;
  const signals: IntentSignal[] = [];

  for (const [event, data] of signalMap.entries()) {
    const rule = rulesMap.get(event);
    const contribution = Math.round(data.totalWeight * 10) / 10;
    rawScore += contribution;

    signals.push({
      event,
      count: data.count,
      lastOccurred: data.lastDate.toISOString(),
      weight: rule?.weight || 1,
      contribution,
    });
  }

  // Normalize to 0-100
  const score = Math.min(100, Math.round(rawScore));

  // Determine level
  let level: IntentScore['level'] = 'cold';
  if (score >= 75) level = 'very_hot';
  else if (score >= 50) level = 'hot';
  else if (score >= 25) level = 'warm';

  // Determine trend (compare last 7 days vs previous 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const recentCount = activities.filter((a) => a.createdAt >= sevenDaysAgo).length;
  const previousCount = activities.filter(
    (a) => a.createdAt >= fourteenDaysAgo && a.createdAt < sevenDaysAgo,
  ).length;

  let trend: IntentScore['trend'] = 'stable';
  if (recentCount > previousCount * 1.5) trend = 'increasing';
  else if (recentCount < previousCount * 0.5) trend = 'decreasing';

  const lastActivity = activities[0]?.createdAt?.toISOString() || new Date().toISOString();

  return {
    leadId,
    score,
    level,
    signals: signals.sort((a, b) => b.contribution - a.contribution),
    lastActivityAt: lastActivity,
    trend,
  };
}

// ---------------------------------------------------------------------------
// getHighIntentLeads
// ---------------------------------------------------------------------------

/**
 * Get leads above an intent score threshold, sorted by score descending.
 */
export async function getHighIntentLeads(
  threshold: number = 50,
  limit: number = 50,
): Promise<HighIntentLead[]> {
  // Get leads with recent intent activity
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const leadIds = await prisma.crmActivity.findMany({
    where: {
      type: 'NOTE',
      leadId: { not: null },
      metadata: {
        path: ['intentCategory'],
        not: Prisma.JsonNull,
      },
      createdAt: { gte: ninetyDaysAgo },
    },
    select: { leadId: true },
    distinct: ['leadId'],
  });

  const uniqueLeadIds = [...new Set(leadIds.map((l) => l.leadId).filter(Boolean))] as string[];

  // Batch fetch all lead details at once instead of one query per lead
  const allLeads = await prisma.crmLead.findMany({
    where: { id: { in: uniqueLeadIds } },
    select: { id: true, contactName: true, companyName: true, email: true },
  });
  const leadMap = new Map(allLeads.map((l) => [l.id, l]));

  // Calculate scores for all leads with intent data
  const results: HighIntentLead[] = [];

  for (const leadId of uniqueLeadIds) {
    try {
      const intentScore = await calculateIntentScore(leadId);

      if (intentScore.score >= threshold) {
        const lead = leadMap.get(leadId);

        if (lead) {
          results.push({
            leadId,
            contactName: lead.contactName,
            companyName: lead.companyName,
            email: lead.email,
            intentScore: intentScore.score,
            level: intentScore.level,
            topSignals: intentScore.signals.slice(0, 3).map((s) => s.event),
            lastActivityAt: intentScore.lastActivityAt,
          });
        }
      }
    } catch (err) {
      logger.warn('[Intent] Score calculation failed for lead', {
        leadId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results
    .sort((a, b) => b.intentScore - a.intentScore)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// getIntentSignals
// ---------------------------------------------------------------------------

/**
 * Get detailed breakdown of intent signals for a specific lead.
 */
export async function getIntentSignals(leadId: string): Promise<IntentSignal[]> {
  const score = await calculateIntentScore(leadId);
  return score.signals;
}

// ---------------------------------------------------------------------------
// configureIntentScoring
// ---------------------------------------------------------------------------

/**
 * Configure custom event weights for intent scoring.
 */
export async function configureIntentScoring(
  rules: IntentScoringRule[],
): Promise<{ success: boolean; error?: string }> {
  if (!rules || rules.length === 0) {
    return { success: false, error: 'At least one scoring rule is required' };
  }

  for (const rule of rules) {
    if (!rule.event) return { success: false, error: 'Each rule must have an event name' };
    if (rule.weight < 0 || rule.weight > 100) {
      return { success: false, error: `Weight for ${rule.event} must be 0-100` };
    }
  }

  await prisma.auditTrail.create({
    data: {
      entityType: 'INTENT_SCORING_CONFIG',
      entityId: 'singleton',
      action: 'CONFIG',
      metadata: { rules } as unknown as Prisma.InputJsonValue,
      userId: 'system',
    },
  });

  logger.info('[Intent] Scoring rules configured', { ruleCount: rules.length });
  return { success: true };
}

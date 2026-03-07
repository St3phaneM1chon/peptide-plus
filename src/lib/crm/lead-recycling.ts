/**
 * CRM Lead Recycling - D10
 *
 * Auto-recycles leads back into dialer campaigns based on disposition codes.
 * Rules: NO_ANSWER after 5 attempts -> recycle in 24h, BUSY -> 1h,
 * VOICEMAIL -> 48h, CALLBACK -> at scheduled time.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecyclingRule {
  disposition: string;
  maxAttempts: number;
  delayMinutes: number;
  useScheduledTime: boolean;
}

export interface RecyclingResult {
  recycled: number;
  skipped: number;
  exhausted: number;
}

// ---------------------------------------------------------------------------
// Default rules
// ---------------------------------------------------------------------------

const DEFAULT_RULES: RecyclingRule[] = [
  { disposition: 'NO_ANSWER',  maxAttempts: 5, delayMinutes: 1440, useScheduledTime: false },
  { disposition: 'BUSY',       maxAttempts: 3, delayMinutes: 60,   useScheduledTime: false },
  { disposition: 'VOICEMAIL',  maxAttempts: 2, delayMinutes: 2880, useScheduledTime: false },
  { disposition: 'CALLBACK',   maxAttempts: 3, delayMinutes: 0,    useScheduledTime: true },
];

// ---------------------------------------------------------------------------
// getRecyclingRules
// ---------------------------------------------------------------------------

export async function getRecyclingRules(campaignId: string): Promise<RecyclingRule[]> {
  const campaign = await prisma.crmCampaign.findUnique({
    where: { id: campaignId },
    select: { targetCriteria: true },
  });
  const meta = (campaign?.targetCriteria as Record<string, unknown>) || {};
  return (meta.recyclingRules as RecyclingRule[]) || DEFAULT_RULES;
}

// ---------------------------------------------------------------------------
// createRecyclingRule
// ---------------------------------------------------------------------------

export async function createRecyclingRule(config: {
  campaignId: string;
  disposition: string;
  maxAttempts: number;
  delayMinutes: number;
  useScheduledTime?: boolean;
}): Promise<RecyclingRule> {
  const campaign = await prisma.crmCampaign.findUniqueOrThrow({
    where: { id: config.campaignId },
    select: { targetCriteria: true },
  });
  const meta = (campaign.targetCriteria as Record<string, unknown>) || {};
  const rules = (meta.recyclingRules as RecyclingRule[]) || [...DEFAULT_RULES];
  const rule: RecyclingRule = {
    disposition: config.disposition.toUpperCase(),
    maxAttempts: config.maxAttempts,
    delayMinutes: config.delayMinutes,
    useScheduledTime: config.useScheduledTime ?? false,
  };
  rules.push(rule);
  meta.recyclingRules = rules;
  await prisma.crmCampaign.update({ where: { id: config.campaignId }, data: { targetCriteria: meta as unknown as Prisma.InputJsonValue } });
  logger.info('Lead recycling: rule created', { event: 'recycling_rule_created', campaignId: config.campaignId, disposition: rule.disposition });
  return rule;
}

// ---------------------------------------------------------------------------
// evaluateRecyclingRules
// ---------------------------------------------------------------------------

export async function evaluateRecyclingRules(
  leadId: string,
  disposition: string,
): Promise<{ shouldRecycle: boolean; recycleAt?: Date; reason: string }> {
  const entry = await prisma.dialerListEntry.findFirst({
    where: { id: leadId },
    include: { campaign: { select: { id: true } }, disposition: true },
  });
  if (!entry) return { shouldRecycle: false, reason: 'Lead not found in dialer list' };

  const rules = await getRecyclingRules(entry.campaignId);
  const rule = rules.find((r) => r.disposition === disposition.toUpperCase());
  if (!rule) return { shouldRecycle: false, reason: `No rule for disposition: ${disposition}` };
  if (entry.callAttempts >= rule.maxAttempts) return { shouldRecycle: false, reason: `Max attempts reached (${entry.callAttempts}/${rule.maxAttempts})` };

  const recycleAt = rule.useScheduledTime && entry.disposition?.callbackAt
    ? new Date(entry.disposition.callbackAt)
    : new Date(Date.now() + rule.delayMinutes * 60_000);
  return { shouldRecycle: true, recycleAt, reason: 'Matches recycling rule' };
}

// ---------------------------------------------------------------------------
// recycleLeads
// ---------------------------------------------------------------------------

export async function recycleLeads(campaignId: string): Promise<RecyclingResult> {
  const rules = await getRecyclingRules(campaignId);
  let recycled = 0, skipped = 0, exhausted = 0;
  const activeDispositions = rules.map((r) => r.disposition);
  if (activeDispositions.length === 0) return { recycled: 0, skipped: 0, exhausted: 0 };

  const entries = await prisma.dialerListEntry.findMany({
    where: { campaignId, isCalled: true, disposition: { type: { in: activeDispositions as never[] } } },
    include: { disposition: true },
  });

  // Collect updates, then batch via transaction instead of N individual updates
  const updateOps: ReturnType<typeof prisma.dialerListEntry.update>[] = [];

  for (const entry of entries) {
    const rule = rules.find((r) => r.disposition === entry.disposition?.type);
    if (!rule) { skipped++; continue; }
    if (entry.callAttempts >= rule.maxAttempts) { exhausted++; continue; }
    const scheduledAt = rule.useScheduledTime && entry.disposition?.callbackAt
      ? new Date(entry.disposition.callbackAt)
      : new Date(Date.now() + rule.delayMinutes * 60_000);
    updateOps.push(
      prisma.dialerListEntry.update({ where: { id: entry.id }, data: { isCalled: false, scheduledAt } })
    );
    recycled++;
  }

  if (updateOps.length > 0) {
    await prisma.$transaction(updateOps);
  }

  logger.info('Lead recycling: batch complete', { event: 'leads_recycled', campaignId, recycled, skipped, exhausted });
  return { recycled, skipped, exhausted };
}

/**
 * CRM SMS Keyword Responder - G14
 *
 * Auto-responds to incoming SMS based on keyword matching. Supports
 * exact keywords, phrase matching, and regex patterns. Handles TCPA/CASL
 * compliance keywords (STOP, HELP, START) as reserved system keywords.
 *
 * Rules are stored in the database via SmsCampaign segmentCriteria
 * and can be configured per-campaign or globally.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KeywordRule {
  id: string;
  keyword: string;          // Keyword or regex pattern
  response: string;         // Auto-reply message
  isRegex: boolean;         // If true, keyword is treated as a regex
  caseSensitive: boolean;
  campaignId?: string;      // If set, only applies to this campaign
  isActive: boolean;
  priority: number;         // Lower = higher priority (evaluated first)
}

export interface KeywordMatchResult {
  matched: boolean;
  ruleId?: string;
  keyword?: string;
  response?: string;
  isSystemKeyword: boolean;
  action?: 'OPT_OUT' | 'OPT_IN' | 'HELP' | 'CUSTOM';
}

// ---------------------------------------------------------------------------
// System keywords (TCPA/CASL compliance - always active)
// ---------------------------------------------------------------------------

const SYSTEM_RULES: KeywordRule[] = [
  {
    id: 'sys-stop',
    keyword: 'STOP',
    response: 'You have been unsubscribed. Reply START to re-subscribe.',
    isRegex: false,
    caseSensitive: false,
    isActive: true,
    priority: 0,
  },
  {
    id: 'sys-help',
    keyword: 'HELP',
    response: 'For support, visit attitudes.vip/help or call 1-800-555-0199. Reply STOP to unsubscribe.',
    isRegex: false,
    caseSensitive: false,
    isActive: true,
    priority: 0,
  },
  {
    id: 'sys-start',
    keyword: 'START',
    response: 'You have been re-subscribed to messages. Reply STOP to unsubscribe.',
    isRegex: false,
    caseSensitive: false,
    isActive: true,
    priority: 0,
  },
];

const STOP_KEYWORDS = new Set(['STOP', 'ARRET', 'ARRÊT', 'UNSUBSCRIBE', 'CANCEL', 'QUIT', 'END']);
const START_KEYWORDS = new Set(['START', 'SUBSCRIBE', 'YES', 'UNSTOP']);
const HELP_KEYWORDS = new Set(['HELP', 'AIDE', 'INFO']);

// ---------------------------------------------------------------------------
// getKeywordRules
// ---------------------------------------------------------------------------

/**
 * Get all keyword rules, including system rules and custom campaign rules.
 */
export async function getKeywordRules(
  campaignId?: string,
): Promise<KeywordRule[]> {
  const rules = [...SYSTEM_RULES];

  // Load campaign-specific rules from DB
  if (campaignId) {
    const campaign = await prisma.smsCampaign.findUnique({
      where: { id: campaignId },
      select: { segmentCriteria: true },
    });

    const meta = (campaign?.segmentCriteria as Record<string, unknown>) || {};
    const custom = (meta.keywordRules as KeywordRule[]) || [];
    rules.push(...custom.filter((r) => r.isActive));
  }

  // Also load global rules (no campaignId)
  const allCampaigns = await prisma.smsCampaign.findMany({
    where: { segmentCriteria: { not: Prisma.DbNull } },
    select: { segmentCriteria: true },
    take: 50,
  });

  for (const c of allCampaigns) {
    const meta = (c.segmentCriteria as Record<string, unknown>) || {};
    const custom = (meta.keywordRules as KeywordRule[]) || [];
    const global = custom.filter((r) => !r.campaignId && r.isActive);
    rules.push(...global);
  }

  // Sort by priority (lower = higher priority)
  rules.sort((a, b) => a.priority - b.priority);

  return rules;
}

// ---------------------------------------------------------------------------
// createKeywordRule
// ---------------------------------------------------------------------------

/**
 * Create a new keyword auto-reply rule for a campaign.
 */
export async function createKeywordRule(config: {
  campaignId: string;
  keyword: string;
  response: string;
  isRegex?: boolean;
  caseSensitive?: boolean;
  priority?: number;
}): Promise<KeywordRule> {
  // Prevent overriding system keywords
  const upperKeyword = config.keyword.toUpperCase().trim();
  if (STOP_KEYWORDS.has(upperKeyword) || START_KEYWORDS.has(upperKeyword) || HELP_KEYWORDS.has(upperKeyword)) {
    throw new Error(`Cannot create rule for reserved system keyword: ${config.keyword}`);
  }

  const campaign = await prisma.smsCampaign.findUniqueOrThrow({
    where: { id: config.campaignId },
    select: { segmentCriteria: true },
  });

  const meta = (campaign.segmentCriteria as Record<string, unknown>) || {};
  const existing = (meta.keywordRules as KeywordRule[]) || [];

  const rule: KeywordRule = {
    id: `kw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    keyword: config.keyword,
    response: config.response,
    isRegex: config.isRegex ?? false,
    caseSensitive: config.caseSensitive ?? false,
    campaignId: config.campaignId,
    isActive: true,
    priority: config.priority ?? 10,
  };

  existing.push(rule);
  meta.keywordRules = existing;

  await prisma.smsCampaign.update({
    where: { id: config.campaignId },
    data: { segmentCriteria: meta as unknown as Prisma.InputJsonValue },
  });

  logger.info('SMS keyword responder: rule created', {
    event: 'keyword_rule_created',
    ruleId: rule.id,
    keyword: rule.keyword,
    campaignId: config.campaignId,
  });

  return rule;
}

// ---------------------------------------------------------------------------
// matchKeyword
// ---------------------------------------------------------------------------

/**
 * Match incoming text against a list of keyword rules.
 * Returns the first matching rule (sorted by priority).
 */
export function matchKeyword(
  text: string,
  rules: KeywordRule[],
): KeywordRule | null {
  const trimmed = text.trim();

  for (const rule of rules) {
    if (!rule.isActive) continue;

    if (rule.isRegex) {
      try {
        const flags = rule.caseSensitive ? '' : 'i';
        const re = new RegExp(rule.keyword, flags);
        if (re.test(trimmed)) return rule;
      } catch {
        // Invalid regex - skip
      }
    } else {
      const keyword = rule.caseSensitive ? rule.keyword : rule.keyword.toUpperCase();
      const input = rule.caseSensitive ? trimmed : trimmed.toUpperCase();
      if (input === keyword) return rule;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// processIncomingSms
// ---------------------------------------------------------------------------

/**
 * Process an incoming SMS and generate an auto-reply if a keyword matches.
 * Handles system keywords (STOP/HELP/START) with compliance actions.
 *
 * @param phone - The sender's phone number
 * @param text - The incoming message body
 * @returns Match result with response text and action taken
 */
export async function processIncomingSms(
  phone: string,
  text: string,
): Promise<KeywordMatchResult> {
  const normalised = text.trim().toUpperCase();

  // 1. Check system keywords first (compliance)
  if (STOP_KEYWORDS.has(normalised)) {
    const cleanPhone = phone.replace(/\D/g, '');
    await prisma.smsOptOut.upsert({
      where: { phone: cleanPhone },
      create: { phone: cleanPhone, reason: `Keyword: ${normalised}` },
      update: { reason: `Keyword: ${normalised}` },
    });

    logger.info('SMS keyword responder: opt-out processed', {
      event: 'keyword_opt_out',
      phone: cleanPhone,
      keyword: normalised,
    });

    const stopRule = SYSTEM_RULES.find((r) => r.id === 'sys-stop')!;
    return {
      matched: true,
      ruleId: stopRule.id,
      keyword: normalised,
      response: stopRule.response,
      isSystemKeyword: true,
      action: 'OPT_OUT',
    };
  }

  if (START_KEYWORDS.has(normalised)) {
    const cleanPhone = phone.replace(/\D/g, '');
    await prisma.smsOptOut.deleteMany({ where: { phone: cleanPhone } });

    logger.info('SMS keyword responder: opt-in processed', {
      event: 'keyword_opt_in',
      phone: cleanPhone,
      keyword: normalised,
    });

    const startRule = SYSTEM_RULES.find((r) => r.id === 'sys-start')!;
    return {
      matched: true,
      ruleId: startRule.id,
      keyword: normalised,
      response: startRule.response,
      isSystemKeyword: true,
      action: 'OPT_IN',
    };
  }

  if (HELP_KEYWORDS.has(normalised)) {
    const helpRule = SYSTEM_RULES.find((r) => r.id === 'sys-help')!;
    return {
      matched: true,
      ruleId: helpRule.id,
      keyword: normalised,
      response: helpRule.response,
      isSystemKeyword: true,
      action: 'HELP',
    };
  }

  // 2. Check custom keyword rules
  const rules = await getKeywordRules();
  const match = matchKeyword(text, rules);

  if (match) {
    logger.info('SMS keyword responder: custom keyword matched', {
      event: 'keyword_custom_match',
      phone,
      keyword: match.keyword,
      ruleId: match.id,
    });

    return {
      matched: true,
      ruleId: match.id,
      keyword: match.keyword,
      response: match.response,
      isSystemKeyword: false,
      action: 'CUSTOM',
    };
  }

  return { matched: false, isSystemKeyword: false };
}

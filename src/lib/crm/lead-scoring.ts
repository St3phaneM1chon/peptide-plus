/**
 * AI Lead Scoring Engine — Multi-factor scoring (0-100)
 *
 * 7 scoring dimensions:
 *   1. Google Rating (0-25)
 *   2. Review Volume (0-15)
 *   3. Website Quality (0-15)
 *   4. Email Available (0-10)
 *   5. Phone Available (0-10)
 *   6. Industry Fit (0-15)
 *   7. Recency (0-10)
 *
 * Auto-temperature: HOT (80-100), WARM (50-79), COLD (0-49)
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreBreakdown {
  googleRating: number;
  reviewVolume: number;
  websiteQuality: number;
  emailAvailable: number;
  phoneAvailable: number;
  industryFit: number;
  recency: number;
  total: number;
  temperature: 'HOT' | 'WARM' | 'COLD';
}

export interface ScoringConfig {
  targetIndustries?: string[];
  targetCompanySizes?: string[];
}

// ---------------------------------------------------------------------------
// Scoring Functions
// ---------------------------------------------------------------------------

function scoreGoogleRating(rating: number | null): number {
  if (!rating) return 0;
  return Math.round((rating / 5) * 25);
}

function scoreReviewVolume(reviewCount: number | null): number {
  if (!reviewCount || reviewCount <= 0) return 0;
  const score = (Math.log10(reviewCount) / Math.log10(1000)) * 15;
  return Math.min(Math.round(score), 15);
}

function scoreWebsiteQuality(website: string | null, enrichmentData: {
  hasSSL?: boolean;
  hasContactPage?: boolean;
  socialLinks?: Record<string, string>;
  linkedinUrl?: string | null;
}): number {
  if (!website) return 0;
  let score = 5;
  if (enrichmentData.hasSSL || website.startsWith('https')) score += 3;
  if (enrichmentData.hasContactPage) score += 3;
  if (enrichmentData.linkedinUrl) score += 2;
  if (enrichmentData.socialLinks && Object.keys(enrichmentData.socialLinks).length > 0) score += 2;
  return Math.min(score, 15);
}

function scoreEmailAvailable(email: string | null): number {
  return email ? 10 : 0;
}

function scorePhoneAvailable(phone: string | null): number {
  return phone ? 10 : 0;
}

function scoreIndustryFit(
  googleCategory: string | null,
  naicsCode: string | null,
  industry: string | null,
  config: ScoringConfig,
): number {
  if (!config.targetIndustries || config.targetIndustries.length === 0) return 8;
  const candidates = [googleCategory, naicsCode, industry].filter(Boolean).map((s) => s!.toLowerCase());
  for (const target of config.targetIndustries) {
    const lower = target.toLowerCase();
    if (candidates.some((c) => c.includes(lower) || lower.includes(c))) return 15;
  }
  return 0;
}

function scoreRecency(
  openingHours: unknown,
  googleReviewCount: number | null,
  updatedAt: Date,
): number {
  let score = 0;
  if (openingHours) score += 5;
  if (googleReviewCount && googleReviewCount > 5) score += 3;
  const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate < 30) score += 2;
  return Math.min(score, 10);
}

function getTemperature(score: number): 'HOT' | 'WARM' | 'COLD' {
  if (score >= 80) return 'HOT';
  if (score >= 50) return 'WARM';
  return 'COLD';
}

// ---------------------------------------------------------------------------
// Main Scoring
// ---------------------------------------------------------------------------

export function calculateScore(
  prospect: {
    googleRating: number | null;
    googleReviewCount: number | null;
    googleCategory: string | null;
    website: string | null;
    email: string | null;
    phone: string | null;
    naicsCode: string | null;
    industry: string | null;
    linkedinUrl: string | null;
    openingHours: unknown;
    customFields: unknown;
    updatedAt: Date;
  },
  config: ScoringConfig = {},
): ScoreBreakdown {
  const customFields = (prospect.customFields as Record<string, unknown>) || {};

  const googleRating = scoreGoogleRating(prospect.googleRating);
  const reviewVolume = scoreReviewVolume(prospect.googleReviewCount);
  const websiteQuality = scoreWebsiteQuality(prospect.website, {
    hasSSL: prospect.website?.startsWith('https') || false,
    hasContactPage: !!customFields.hasContactPage,
    socialLinks: customFields.socialLinks as Record<string, string> | undefined,
    linkedinUrl: prospect.linkedinUrl,
  });
  const emailAvailable = scoreEmailAvailable(prospect.email);
  const phoneAvailable = scorePhoneAvailable(prospect.phone);
  const industryFit = scoreIndustryFit(prospect.googleCategory, prospect.naicsCode, prospect.industry, config);
  const recency = scoreRecency(prospect.openingHours, prospect.googleReviewCount, prospect.updatedAt);

  const total = Math.min(
    googleRating + reviewVolume + websiteQuality + emailAvailable + phoneAvailable + industryFit + recency,
    100,
  );

  return {
    googleRating,
    reviewVolume,
    websiteQuality,
    emailAvailable,
    phoneAvailable,
    industryFit,
    recency,
    total,
    temperature: getTemperature(total),
  };
}

// ---------------------------------------------------------------------------
// Score & update a single prospect
// ---------------------------------------------------------------------------

export async function scoreProspect(
  prospectId: string,
  config: ScoringConfig = {},
): Promise<ScoreBreakdown> {
  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) throw new Error(`Prospect ${prospectId} not found`);

  const breakdown = calculateScore(prospect as Parameters<typeof calculateScore>[0], config);

  await prisma.prospect.update({
    where: { id: prospectId },
    data: { enrichmentScore: breakdown.total },
  });

  return breakdown;
}

// ---------------------------------------------------------------------------
// Batch score entire list
// ---------------------------------------------------------------------------

export async function scoreProspectList(
  listId: string,
  config: ScoringConfig = {},
): Promise<{ scored: number; averageScore: number; distribution: { hot: number; warm: number; cold: number } }> {
  const prospects = await prisma.prospect.findMany({
    where: { listId, status: { notIn: ['MERGED', 'EXCLUDED'] } },
  });

  let totalScore = 0;
  const distribution = { hot: 0, warm: 0, cold: 0 };

  for (const prospect of prospects) {
    const breakdown = calculateScore(prospect as Parameters<typeof calculateScore>[0], config);
    totalScore += breakdown.total;

    if (breakdown.temperature === 'HOT') distribution.hot++;
    else if (breakdown.temperature === 'WARM') distribution.warm++;
    else distribution.cold++;

    await prisma.prospect.update({
      where: { id: prospect.id },
      data: { enrichmentScore: breakdown.total },
    });
  }

  const averageScore = prospects.length > 0 ? Math.round(totalScore / prospects.length) : 0;
  logger.info('Scoring completed', { listId, scored: prospects.length, averageScore, distribution });

  return { scored: prospects.length, averageScore, distribution };
}

// ---------------------------------------------------------------------------
// Auto-qualify: validate prospects with score >= threshold AND (email OR phone)
// ---------------------------------------------------------------------------

export async function autoQualifyList(
  listId: string,
  threshold = 50,
): Promise<{ qualified: number; skipped: number }> {
  const prospects = await prisma.prospect.findMany({
    where: {
      listId,
      status: 'NEW',
      enrichmentScore: { gte: threshold },
      OR: [
        { email: { not: null } },
        { phone: { not: null } },
      ],
    },
    select: { id: true },
  });

  if (prospects.length === 0) return { qualified: 0, skipped: 0 };

  await prisma.prospect.updateMany({
    where: { id: { in: prospects.map((p) => p.id) } },
    data: { status: 'VALIDATED' },
  });

  const total = await prisma.prospect.count({
    where: { listId, status: 'NEW' },
  });

  logger.info('Auto-qualification completed', { listId, qualified: prospects.length, remaining: total });
  return { qualified: prospects.length, skipped: total };
}

// ---------------------------------------------------------------------------
// BANT Pre-fill
// ---------------------------------------------------------------------------

export function generateBANT(prospect: {
  companySize: string | null;
  jobTitle: string | null;
  industry: string | null;
  googleCategory: string | null;
  enrichmentScore: number | null;
}): Record<string, unknown> {
  const bant: Record<string, unknown> = {};

  if (prospect.companySize) {
    const sizeMap: Record<string, string> = {
      '1-10': 'LOW', '11-50': 'MEDIUM', '51-200': 'MEDIUM_HIGH',
      '201-500': 'HIGH', '501-1000': 'HIGH', '1000+': 'ENTERPRISE',
    };
    bant.budget = sizeMap[prospect.companySize] || 'UNKNOWN';
    bant.budgetIndicator = prospect.companySize;
  }

  if (prospect.jobTitle) {
    const title = prospect.jobTitle.toLowerCase();
    if (/ceo|president|owner|founder|director|vp|chief/i.test(title)) {
      bant.authority = 'DECISION_MAKER';
    } else if (/manager|head|lead|supervisor/i.test(title)) {
      bant.authority = 'INFLUENCER';
    } else {
      bant.authority = 'USER';
    }
    bant.authorityTitle = prospect.jobTitle;
  }

  bant.need = prospect.industry || prospect.googleCategory || 'UNKNOWN';

  if (prospect.enrichmentScore && prospect.enrichmentScore >= 80) {
    bant.timeline = 'IMMEDIATE';
  } else if (prospect.enrichmentScore && prospect.enrichmentScore >= 50) {
    bant.timeline = 'SHORT_TERM';
  } else {
    bant.timeline = 'LONG_TERM';
  }

  return bant;
}

/**
 * EMAIL BOUNCE HANDLER
 *
 * Improvement #46: Handle email bounces (hard/soft)
 * Improvement #49: Delivery tracking with status updates
 *
 * - Tracks bounces in EmailLog with status 'bounced'
 * - Hard bounces: suppress future sends to that address
 * - Soft bounces: allow retries but flag after 3 soft bounces
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BounceType = 'hard' | 'soft';
export type BounceSubtype = 'invalid_address' | 'full_mailbox' | 'domain_not_found' | 'rejected' | 'temporary' | 'unknown';
export type DeliveryStatus = 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed' | 'complained' | 'delayed';

export interface BounceEvent {
  email: string;
  bounceType: BounceType;
  provider: string;
  reason?: string;
  messageId?: string;
  timestamp?: Date;
}

export interface DeliveryEvent {
  email: string;
  status: DeliveryStatus;
  messageId: string;
  provider: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Bounce reason categorization
// ---------------------------------------------------------------------------

/**
 * Categorize a bounce reason string into a standardized subtype.
 * Used to enrich bounce logs and analytics with actionable categories.
 */
export function categorizeBounceReason(reason?: string): BounceSubtype {
  if (!reason) return 'unknown';
  const r = reason.toLowerCase();
  if (r.includes('invalid') || r.includes('not found') || r.includes('does not exist') || r.includes('no such user')) return 'invalid_address';
  if (r.includes('full') || r.includes('quota') || r.includes('over quota') || r.includes('mailbox full')) return 'full_mailbox';
  if (r.includes('domain') || r.includes('dns') || r.includes('mx')) return 'domain_not_found';
  if (r.includes('reject') || r.includes('blocked') || r.includes('spam') || r.includes('blacklist')) return 'rejected';
  if (r.includes('temporary') || r.includes('try again') || r.includes('later') || r.includes('timeout')) return 'temporary';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// In-memory bounce cache (to avoid DB lookups on every send)
// ---------------------------------------------------------------------------

const BOUNCE_CACHE_MAX_SIZE = 10000;
const BOUNCE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const bounceCache = new Map<string, { type: BounceType; count: number; lastBounce: Date; cachedAt: number }>();
const HARD_BOUNCE_SUPPRESS = true;
const SOFT_BOUNCE_MAX = parseInt(process.env.SOFT_BOUNCE_MAX || '3', 10);

/** Evict expired entries and enforce max cache size */
function evictBounceCache(): void {
  const now = Date.now();
  let expiredCount = 0;
  let culledCount = 0;
  // Evict expired entries
  for (const [key, entry] of bounceCache) {
    if (now - entry.cachedAt > BOUNCE_CACHE_TTL_MS) {
      bounceCache.delete(key);
      expiredCount++;
    }
  }
  // If still over limit, remove oldest entries
  if (bounceCache.size > BOUNCE_CACHE_MAX_SIZE) {
    const entries = [...bounceCache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    const toRemove = entries.slice(0, bounceCache.size - BOUNCE_CACHE_MAX_SIZE);
    for (const [key] of toRemove) {
      bounceCache.delete(key);
      culledCount++;
    }
  }
  if (expiredCount > 0 || culledCount > 0) {
    logger.debug('[bounce-handler] Cache evicted', { expired: expiredCount, culled: culledCount });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if an email address should be suppressed due to bounces.
 * Uses persistent EmailSuppression table (Faille #12) with in-memory cache as fast path.
 */
export async function shouldSuppressEmail(email: string): Promise<{
  suppressed: boolean;
  reason?: string;
}> {
  const normalizedEmail = email.toLowerCase().trim();

  // Fast path: check in-memory cache (with TTL)
  const cached = bounceCache.get(normalizedEmail);
  if (cached && (Date.now() - cached.cachedAt) < BOUNCE_CACHE_TTL_MS) {
    if (cached.type === 'hard' && HARD_BOUNCE_SUPPRESS) {
      return { suppressed: true, reason: `Hard bounce on ${cached.lastBounce.toISOString()}` };
    }
    if (cached.type === 'soft' && cached.count >= SOFT_BOUNCE_MAX) {
      return { suppressed: true, reason: `${cached.count} soft bounces, last on ${cached.lastBounce.toISOString()}` };
    }
  } else if (cached) {
    bounceCache.delete(normalizedEmail);
  }

  // Check persistent suppression list and bounces in parallel (performance optimization)
  try {
    const [suppression, bounces] = await Promise.all([
      prisma.emailSuppression.findUnique({
        where: { email: normalizedEmail },
      }),
      prisma.emailBounce.findMany({
        where: { email: normalizedEmail },
        orderBy: { lastBounce: 'desc' },
        take: 5,
      }),
    ]);

    // Faille #12: check persistent suppression list
    if (suppression) {
      // Check if suppression has expired
      if (!suppression.expiresAt || suppression.expiresAt > new Date()) {
        bounceCache.set(normalizedEmail, {
          type: 'hard', count: 1, lastBounce: suppression.createdAt, cachedAt: Date.now(),
        });
        return { suppressed: true, reason: `Suppressed: ${suppression.reason}` };
      }
    }

    // Faille #11: check persistent bounces
    if (bounces.length === 0) return { suppressed: false };

    const hardBounce = bounces.find(b => b.bounceType === 'hard');
    if (hardBounce) {
      // Auto-add to suppression list
      await prisma.emailSuppression.upsert({
        where: { email: normalizedEmail },
        update: {},
        create: { email: normalizedEmail, reason: 'hard_bounce', provider: hardBounce.provider },
      });
      bounceCache.set(normalizedEmail, {
        type: 'hard', count: 1, lastBounce: hardBounce.lastBounce, cachedAt: Date.now(),
      });
      return { suppressed: true, reason: 'Hard bounce detected' };
    }

    const totalSoftCount = bounces.reduce((sum, b) => sum + b.count, 0);
    if (totalSoftCount >= SOFT_BOUNCE_MAX) {
      bounceCache.set(normalizedEmail, {
        type: 'soft', count: totalSoftCount, lastBounce: bounces[0].lastBounce, cachedAt: Date.now(),
      });
      return { suppressed: true, reason: `${totalSoftCount} soft bounces` };
    }

    return { suppressed: false };
  } catch (err) {
    logger.error('[bounce-handler] Error checking bounce status', {
      email: normalizedEmail,
      error: err instanceof Error ? err.message : String(err),
    });
    return { suppressed: false, reason: 'Error checking bounce status - allowing send' };
  }
}

/**
 * Record a bounce event
 */
export async function recordBounce(event: BounceEvent): Promise<void> {
  const normalizedEmail = event.email.toLowerCase().trim();

  try {
    const now = event.timestamp || new Date();

    // Persist to EmailBounce model (Faille #11)
    const existingBounce = await prisma.emailBounce.findFirst({
      where: { email: normalizedEmail, bounceType: event.bounceType },
    });
    if (existingBounce) {
      await prisma.emailBounce.update({
        where: { id: existingBounce.id },
        data: { count: existingBounce.count + 1, lastBounce: now, reason: event.reason || existingBounce.reason },
      });
    } else {
      await prisma.emailBounce.create({
        data: {
          email: normalizedEmail,
          bounceType: event.bounceType,
          provider: event.provider,
          reason: event.reason,
          messageId: event.messageId,
          lastBounce: now,
        },
      });
    }

    // Auto-suppress on hard bounce or complaint (Faille #12)
    if (event.bounceType === 'hard') {
      const isComplaint = event.reason?.startsWith('complaint:');
      // Complaints expire after 180 days (user may re-opt-in); hard bounces are permanent
      const expiresAt = isComplaint
        ? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
        : null;
      await prisma.emailSuppression.upsert({
        where: { email: normalizedEmail },
        update: { reason: isComplaint ? 'complaint' : 'hard_bounce', expiresAt },
        create: {
          email: normalizedEmail,
          reason: isComplaint ? 'complaint' : 'hard_bounce',
          provider: event.provider,
          expiresAt,
        },
      });
    }

    // Categorize the bounce reason for enriched logging
    const bounceSubtype = categorizeBounceReason(event.reason);

    // Log to EmailLog (existing behavior, now with subtype)
    await prisma.emailLog.create({
      data: {
        // AMELIORATION: Use crypto.randomUUID instead of Math.random for log IDs
        id: `bounce-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        templateId: 'bounce-notification',
        to: normalizedEmail,
        subject: `Bounce: ${event.bounceType}`,
        status: 'bounced',
        error: `${event.bounceType}:${event.provider}:${bounceSubtype}:${event.reason || 'unknown'}`,
        sentAt: now,
      },
    });

    // Update in-memory cache
    evictBounceCache();
    const cachedEntry = bounceCache.get(normalizedEmail);
    bounceCache.set(normalizedEmail, {
      type: event.bounceType === 'hard' ? 'hard' : (cachedEntry?.type || 'soft'),
      count: (cachedEntry?.count || 0) + 1,
      lastBounce: now,
      cachedAt: Date.now(),
    });

    logger.info('[bounce-handler] Bounce recorded', {
      email: normalizedEmail,
      type: event.bounceType,
      subtype: bounceSubtype,
      provider: event.provider,
    });
  } catch (err) {
    logger.error('[bounce-handler] Failed to record bounce', {
      email: normalizedEmail,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Improvement #49: Update delivery status for an email
 * Faille #32: Dedup check — skip if this messageId+status was already recorded
 */
export async function updateDeliveryStatus(event: DeliveryEvent): Promise<void> {
  try {
    const normalizedEmail = event.email.toLowerCase().trim();

    // Faille #32: Deduplicate by messageId+status to avoid processing the same webhook event twice.
    // EmailLog.messageId is not unique (nullable), so dedup is enforced in code.
    if (event.messageId) {
      const alreadyRecorded = await prisma.emailLog.findFirst({
        where: { messageId: event.messageId, status: event.status },
        select: { id: true },
      });
      if (alreadyRecorded) {
        logger.debug('[bounce-handler] Duplicate delivery event skipped', {
          messageId: event.messageId,
          status: event.status,
        });
        return;
      }
    }

    // Try to find by messageId first (most accurate)
    let existing = event.messageId
      ? await prisma.emailLog.findFirst({
          where: { messageId: event.messageId },
        })
      : null;

    // Fallback: find by email + recency if messageId doesn't match
    if (!existing) {
      existing = await prisma.emailLog.findFirst({
        where: {
          to: normalizedEmail,
          sentAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        orderBy: { sentAt: 'desc' },
      });
    }

    if (existing) {
      await prisma.emailLog.update({
        where: { id: existing.id },
        data: {
          status: event.status,
          error: event.status === 'bounced' ? `${event.provider}:bounce` : existing.error,
        },
      });

      // Propagate stats to campaign if applicable
      if (existing.templateId?.startsWith('campaign:')) {
        const campaignId = existing.templateId.replace('campaign:', '');
        await propagateCampaignStat(campaignId, event.status).catch(() => {});
      }

      // Propagate stats to flow if applicable
      if (existing.templateId?.startsWith('flow:')) {
        const flowId = existing.templateId.replace('flow:', '');
        await propagateFlowStat(flowId, event.status).catch(() => {});
      }
    }

    logger.debug('[bounce-handler] Delivery status updated', {
      email: event.email,
      status: event.status,
      messageId: event.messageId,
    });
  } catch (err) {
    logger.error('[bounce-handler] Failed to update delivery status', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Propagate delivery event to campaign stats (atomic JSON update).
 *
 * Safety: `statKey` is validated against an explicit allowlist before being
 * interpolated into the tagged template literal. Prisma parameterizes all
 * `${}` expressions as bind parameters (`$1`, `$2`, ...) so values never
 * appear as raw SQL, but the allowlist provides defense-in-depth.
 */
const CAMPAIGN_STAT_KEYS = new Set(['opened', 'clicked', 'delivered', 'bounced']);

async function propagateCampaignStat(campaignId: string, status: DeliveryStatus): Promise<void> {
  const statKey = status === 'opened' ? 'opened'
    : status === 'clicked' ? 'clicked'
    : status === 'delivered' ? 'delivered'
    : status === 'bounced' ? 'bounced'
    : null;

  if (!statKey || !CAMPAIGN_STAT_KEYS.has(statKey)) return;

  const jsonPath = `{${statKey}}`;
  try {
    await prisma.$executeRaw`
      UPDATE "EmailCampaign"
      SET stats = jsonb_set(
        COALESCE(stats::jsonb, '{}'::jsonb),
        ${jsonPath}::text[],
        (COALESCE((stats::jsonb->>${statKey})::int, 0) + 1)::text::jsonb
      )
      WHERE id = ${campaignId}
    `;
  } catch (err) {
    logger.error('[bounce-handler] Failed to propagate campaign stat', {
      campaignId,
      status,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Propagate delivery event to flow stats (atomic JSON update).
 *
 * Safety: `statKey` is validated against an explicit allowlist (defense-in-depth).
 * All `${}` values are Prisma-parameterized bind parameters.
 */
const FLOW_STAT_KEYS = new Set(['opened', 'clicked', 'delivered', 'bounced']);

async function propagateFlowStat(flowId: string, status: DeliveryStatus): Promise<void> {
  const statKey = status === 'opened' ? 'opened'
    : status === 'clicked' ? 'clicked'
    : status === 'delivered' ? 'delivered'
    : status === 'bounced' ? 'bounced'
    : null;

  if (!statKey || !FLOW_STAT_KEYS.has(statKey)) return;

  const jsonPath = `{${statKey}}`;
  try {
    await prisma.$executeRaw`
      UPDATE "EmailAutomationFlow"
      SET stats = jsonb_set(
        COALESCE(stats::jsonb, '{"triggered":0,"sent":0,"delivered":0,"opened":0,"clicked":0,"bounced":0,"revenue":0}'::jsonb),
        ${jsonPath}::text[],
        (COALESCE((stats::jsonb->>${statKey})::int, 0) + 1)::text::jsonb
      )
      WHERE id = ${flowId}
    `;
  } catch (err) {
    logger.error('[bounce-handler] Failed to propagate flow stat', {
      flowId,
      status,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Clear bounce cache for a specific email (e.g., after manual review)
 */
export function clearBounceCache(email: string): void {
  bounceCache.delete(email.toLowerCase().trim());
}

/**
 * Get bounce statistics
 */
export function getBounceStats(): {
  cachedEntries: number;
  hardBounces: number;
  softBounces: number;
} {
  let hard = 0;
  let soft = 0;
  for (const entry of bounceCache.values()) {
    if (entry.type === 'hard') hard++;
    else soft++;
  }
  return { cachedEntries: bounceCache.size, hardBounces: hard, softBounces: soft };
}

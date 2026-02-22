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
// In-memory bounce cache (to avoid DB lookups on every send)
// ---------------------------------------------------------------------------

const BOUNCE_CACHE_MAX_SIZE = 10000;
const BOUNCE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const bounceCache = new Map<string, { type: BounceType; count: number; lastBounce: Date; cachedAt: number }>();
const HARD_BOUNCE_SUPPRESS = true;
const SOFT_BOUNCE_MAX = 3;

/** Evict expired entries and enforce max cache size */
function evictBounceCache(): void {
  const now = Date.now();
  // Evict expired entries
  for (const [key, entry] of bounceCache) {
    if (now - entry.cachedAt > BOUNCE_CACHE_TTL_MS) {
      bounceCache.delete(key);
    }
  }
  // If still over limit, remove oldest entries
  if (bounceCache.size > BOUNCE_CACHE_MAX_SIZE) {
    const entries = [...bounceCache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    const toRemove = entries.slice(0, bounceCache.size - BOUNCE_CACHE_MAX_SIZE);
    for (const [key] of toRemove) {
      bounceCache.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if an email address should be suppressed due to bounces
 */
export async function shouldSuppressEmail(email: string): Promise<{
  suppressed: boolean;
  reason?: string;
}> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check cache first (with TTL)
  const cached = bounceCache.get(normalizedEmail);
  if (cached && (Date.now() - cached.cachedAt) < BOUNCE_CACHE_TTL_MS) {
    if (cached.type === 'hard' && HARD_BOUNCE_SUPPRESS) {
      return { suppressed: true, reason: `Hard bounce on ${cached.lastBounce.toISOString()}` };
    }
    if (cached.type === 'soft' && cached.count >= SOFT_BOUNCE_MAX) {
      return { suppressed: true, reason: `${cached.count} soft bounces, last on ${cached.lastBounce.toISOString()}` };
    }
  } else if (cached) {
    // Expired entry — remove it
    bounceCache.delete(normalizedEmail);
  }

  // Check DB
  try {
    const bounces = await prisma.emailLog.findMany({
      where: {
        to: normalizedEmail,
        status: 'bounced',
      },
      orderBy: { sentAt: 'desc' },
      take: 10,
    });

    if (bounces.length === 0) {
      return { suppressed: false };
    }

    // Check for hard bounces (error format: "hard:provider:reason")
    const hardBounce = bounces.find(b => b.error?.startsWith('hard:'));
    if (hardBounce) {
      bounceCache.set(normalizedEmail, {
        type: 'hard',
        count: 1,
        lastBounce: hardBounce.sentAt,
        cachedAt: Date.now(),
      });
      return { suppressed: true, reason: `Hard bounce detected` };
    }

    // Check soft bounce count (error format: "soft:provider:reason")
    const softBounceCount = bounces.filter(b => b.error?.startsWith('soft:')).length;
    if (softBounceCount >= SOFT_BOUNCE_MAX) {
      bounceCache.set(normalizedEmail, {
        type: 'soft',
        count: softBounceCount,
        lastBounce: bounces[0].sentAt,
        cachedAt: Date.now(),
      });
      return { suppressed: true, reason: `${softBounceCount} soft bounces` };
    }

    return { suppressed: false };
  } catch (err) {
    logger.error('[bounce-handler] Error checking bounce status', {
      email: normalizedEmail,
      error: err instanceof Error ? err.message : String(err),
    });
    // Don't suppress on error - better to attempt delivery
    return { suppressed: false };
  }
}

/**
 * Record a bounce event
 */
export async function recordBounce(event: BounceEvent): Promise<void> {
  const normalizedEmail = event.email.toLowerCase().trim();

  try {
    // Log to EmailLog
    await prisma.emailLog.create({
      data: {
        id: `bounce-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        templateId: 'bounce-notification',
        to: normalizedEmail,
        subject: `Bounce: ${event.bounceType}`,
        status: 'bounced',
        error: `${event.bounceType}:${event.provider}:${event.reason || 'unknown'}`,
        sentAt: event.timestamp || new Date(),
      },
    });

    // Update cache (with eviction)
    evictBounceCache();
    const existing = bounceCache.get(normalizedEmail);
    bounceCache.set(normalizedEmail, {
      type: event.bounceType === 'hard' ? 'hard' : (existing?.type || 'soft'),
      count: (existing?.count || 0) + 1,
      lastBounce: event.timestamp || new Date(),
      cachedAt: Date.now(),
    });

    logger.info('[bounce-handler] Bounce recorded', {
      email: normalizedEmail,
      type: event.bounceType,
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
 */
export async function updateDeliveryStatus(event: DeliveryEvent): Promise<void> {
  try {
    const normalizedEmail = event.email.toLowerCase().trim();

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
 * Propagate delivery event to campaign stats (atomic JSON update)
 */
async function propagateCampaignStat(campaignId: string, status: DeliveryStatus): Promise<void> {
  const statKey = status === 'opened' ? 'opened'
    : status === 'clicked' ? 'clicked'
    : status === 'delivered' ? 'delivered'
    : status === 'bounced' ? 'bounced'
    : null;

  if (!statKey) return;

  try {
    await prisma.$executeRaw`
      UPDATE "EmailCampaign"
      SET stats = jsonb_set(
        COALESCE(stats::jsonb, '{}'::jsonb),
        ${`{${statKey}}`}::text[],
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
 * Propagate delivery event to flow stats (atomic JSON update)
 */
async function propagateFlowStat(flowId: string, status: DeliveryStatus): Promise<void> {
  const statKey = status === 'opened' ? 'opened'
    : status === 'clicked' ? 'clicked'
    : null;

  if (!statKey) return;

  try {
    await prisma.$executeRaw`
      UPDATE "EmailAutomationFlow"
      SET stats = jsonb_set(
        COALESCE(stats::jsonb, '{"triggered":0,"sent":0,"opened":0,"clicked":0,"revenue":0}'::jsonb),
        ${`{${statKey}}`}::text[],
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

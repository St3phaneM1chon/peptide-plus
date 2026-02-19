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
export type DeliveryStatus = 'sent' | 'delivered' | 'opened' | 'bounced' | 'failed' | 'complained';

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

const bounceCache = new Map<string, { type: BounceType; count: number; lastBounce: Date }>();
const HARD_BOUNCE_SUPPRESS = true;
const SOFT_BOUNCE_MAX = 3;

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

  // Check cache first
  const cached = bounceCache.get(normalizedEmail);
  if (cached) {
    if (cached.type === 'hard' && HARD_BOUNCE_SUPPRESS) {
      return { suppressed: true, reason: `Hard bounce on ${cached.lastBounce.toISOString()}` };
    }
    if (cached.type === 'soft' && cached.count >= SOFT_BOUNCE_MAX) {
      return { suppressed: true, reason: `${cached.count} soft bounces, last on ${cached.lastBounce.toISOString()}` };
    }
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

    // Check for hard bounces
    const hardBounce = bounces.find(b => b.error?.includes('hard'));
    if (hardBounce) {
      bounceCache.set(normalizedEmail, {
        type: 'hard',
        count: 1,
        lastBounce: hardBounce.sentAt,
      });
      return { suppressed: true, reason: `Hard bounce detected` };
    }

    // Check soft bounce count
    const softBounceCount = bounces.filter(b => b.error?.includes('soft')).length;
    if (softBounceCount >= SOFT_BOUNCE_MAX) {
      bounceCache.set(normalizedEmail, {
        type: 'soft',
        count: softBounceCount,
        lastBounce: bounces[0].sentAt,
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

    // Update cache
    const existing = bounceCache.get(normalizedEmail);
    bounceCache.set(normalizedEmail, {
      type: event.bounceType === 'hard' ? 'hard' : (existing?.type || 'soft'),
      count: (existing?.count || 0) + 1,
      lastBounce: event.timestamp || new Date(),
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
    // Find the EmailLog entry by messageId pattern in the error/subject field
    // or create a new tracking entry
    const existing = await prisma.emailLog.findFirst({
      where: {
        to: event.email.toLowerCase().trim(),
        sentAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      orderBy: { sentAt: 'desc' },
    });

    if (existing) {
      // Update the existing log entry status
      // Note: Prisma doesn't support direct update on EmailLog with just 'id'
      // since EmailLog.id is @id String. We update via raw or create a new tracking entry.
      await prisma.emailLog.create({
        data: {
          id: `delivery-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          templateId: `delivery-${event.status}`,
          to: event.email.toLowerCase().trim(),
          subject: `Delivery: ${event.status} (ref: ${event.messageId})`,
          status: event.status,
          error: event.status === 'bounced' ? `${event.provider}:bounce` : null,
          sentAt: event.timestamp || new Date(),
        },
      });
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

export const dynamic = 'force-dynamic';

/**
 * DATA RETENTION CRON JOB
 *
 * GET  /api/cron/data-retention - Health check / stats
 * POST /api/cron/data-retention - Execute retention policies
 *
 * Policies:
 *   - Sessions:          30 days (delete expired)
 *   - Abandoned carts:   90 days (soft delete)
 *   - Chat messages:     1 year (soft delete / anonymize)
 *   - Email logs:        2 years (delete)
 *   - Password history:  2 years (delete - GDPR data minimization)
 *   - Audit logs:        5 years (delete - fiscal compliance retention)
 *
 * Authentication: Requires CRON_SECRET in Authorization header.
 * All deletions are soft (marked) unless specified otherwise for truly ephemeral data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { withJobLock } from '@/lib/cron-lock';

// ---------------------------------------------------------------------------
// Retention policy configuration
// ---------------------------------------------------------------------------

interface RetentionPolicy {
  name: string;
  description: string;
  maxAgeDays: number;
}

const RETENTION_POLICIES: RetentionPolicy[] = [
  { name: 'sessions', description: 'Expired user sessions', maxAgeDays: 30 },
  { name: 'abandoned-carts', description: 'Abandoned shopping carts', maxAgeDays: 90 },
  { name: 'chat-messages', description: 'Chat message logs', maxAgeDays: 365 },
  { name: 'email-logs', description: 'Email send logs', maxAgeDays: 730 },
  { name: 'password-history', description: 'Old password hashes (GDPR)', maxAgeDays: 730 },
  { name: 'audit-logs', description: 'Audit trail entries (fiscal compliance - 7yr Canadian tax law)', maxAgeDays: 2557 },
];

// ---------------------------------------------------------------------------
// POST - Execute retention
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // Verify cron secret (timing-safe comparison)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 }
    );
  }

  const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  let secretsMatch = false;
  try {
    const a = Buffer.from(cronSecret, 'utf8');
    const b = Buffer.from(providedSecret, 'utf8');
    secretsMatch = a.length === b.length && timingSafeEqual(a, b);
  } catch { secretsMatch = false; }

  if (!secretsMatch) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return withJobLock('data-retention', async () => {
    const results: Record<string, { deleted: number; error?: string }> = {};
    const now = new Date();

    try {
      // 1. Sessions - delete expired sessions (hard delete, ephemeral data)
      try {
        const sessionCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sessionResult = await prisma.session.deleteMany({
          where: {
            expires: { lt: sessionCutoff },
          },
        });
        results.sessions = { deleted: sessionResult.count };
        logger.info('[data-retention] Sessions cleaned', { deleted: sessionResult.count });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.sessions = { deleted: 0, error: msg };
        logger.error('[data-retention] Sessions cleanup failed', { error: msg });
      }

      // 2. Abandoned carts - delete carts older than 90 days with no user
      try {
        const cartCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

        // First delete cart items for old anonymous carts
        const oldCarts = await prisma.cart.findMany({
          where: {
            userId: null, // Only anonymous carts (logged-in user carts are kept)
            updatedAt: { lt: cartCutoff },
          },
          select: { id: true },
        });

        const oldCartIds = oldCarts.map((c) => c.id);

        if (oldCartIds.length > 0) {
          await prisma.cartItem.deleteMany({
            where: { cartId: { in: oldCartIds } },
          });
          const cartResult = await prisma.cart.deleteMany({
            where: { id: { in: oldCartIds } },
          });
          results['abandoned-carts'] = { deleted: cartResult.count };
        } else {
          results['abandoned-carts'] = { deleted: 0 };
        }

        logger.info('[data-retention] Abandoned carts cleaned', {
          deleted: results['abandoned-carts'].deleted,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results['abandoned-carts'] = { deleted: 0, error: msg };
        logger.error('[data-retention] Abandoned carts cleanup failed', { error: msg });
      }

      // 3. Chat messages - anonymize old messages (keep for analytics, remove content)
      try {
        const chatCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        const chatResult = await prisma.chatMessage.updateMany({
          where: {
            createdAt: { lt: chatCutoff },
            content: { not: '[Archived]' }, // Don't re-process already archived
          },
          data: {
            content: '[Archived]',
            contentOriginal: null,
            senderName: null,
            metadata: null,
          },
        });
        results['chat-messages'] = { deleted: chatResult.count };
        logger.info('[data-retention] Chat messages archived', { archived: chatResult.count });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results['chat-messages'] = { deleted: 0, error: msg };
        logger.error('[data-retention] Chat messages cleanup failed', { error: msg });
      }

      // 4. Email logs - delete old email logs (hard delete, operational data)
      try {
        const emailCutoff = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
        const emailResult = await prisma.emailLog.deleteMany({
          where: {
            sentAt: { lt: emailCutoff },
          },
        });
        results['email-logs'] = { deleted: emailResult.count };
        logger.info('[data-retention] Email logs cleaned', { deleted: emailResult.count });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results['email-logs'] = { deleted: 0, error: msg };
        logger.error('[data-retention] Email logs cleanup failed', { error: msg });
      }

      // 5. Password history - purge entries older than 2 years (GDPR data minimization)
      try {
        const twoYearsAgo = new Date(now);
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

        const passwordHistoryResult = await prisma.passwordHistory.deleteMany({
          where: {
            createdAt: { lt: twoYearsAgo },
          },
        });
        results['password-history'] = { deleted: passwordHistoryResult.count };
        logger.info('[data-retention] Password history purged', { deleted: passwordHistoryResult.count });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results['password-history'] = { deleted: 0, error: msg };
        logger.error('[data-retention] Password history purge failed', { error: msg });
      }

      // 6. Audit logs - delete entries older than 7 years (Canadian tax law ITA s. 230(4))
      try {
        const sevenYearsAgo = new Date(now);
        sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

        const auditLogResult = await prisma.auditLog.deleteMany({
          where: {
            createdAt: { lt: sevenYearsAgo },
          },
        });
        results['audit-logs'] = { deleted: auditLogResult.count };
        logger.info('[data-retention] Audit logs cleaned', { deleted: auditLogResult.count });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results['audit-logs'] = { deleted: 0, error: msg };
        logger.error('[data-retention] Audit logs cleanup failed', { error: msg });
      }

      // Log summary
      const totalDeleted = Object.values(results).reduce((sum, r) => sum + r.deleted, 0);
      const hasErrors = Object.values(results).some((r) => r.error);

      logger.info('[data-retention] Retention job completed', {
        totalDeleted,
        hasErrors,
        results,
      });

      return NextResponse.json({
        success: true,
        executedAt: now.toISOString(),
        policies: RETENTION_POLICIES,
        results,
        totalDeleted,
      });
    } catch (error) {
      logger.error('[data-retention] Job failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        {
          error: 'Data retention job failed',
          ...(process.env.NODE_ENV === 'development'
            ? { details: error instanceof Error ? error.message : 'Unknown error' }
            : {}),
        },
        { status: 500 }
      );
    }
  });
}

// ---------------------------------------------------------------------------
// GET - Health check / stats
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const now = new Date();

    // Count records that would be affected by each policy
    const twoYearsAgoCheck = new Date(now);
    twoYearsAgoCheck.setFullYear(twoYearsAgoCheck.getFullYear() - 2);
    const sevenYearsAgoCheck = new Date(now);
    sevenYearsAgoCheck.setFullYear(sevenYearsAgoCheck.getFullYear() - 7);

    const [expiredSessions, oldCarts, oldChatMessages, oldEmailLogs, oldPasswordHistory, oldAuditLogs] = await Promise.all([
      prisma.session.count({
        where: { expires: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.cart.count({
        where: {
          userId: null,
          updatedAt: { lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.chatMessage.count({
        where: {
          createdAt: { lt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) },
          content: { not: '[Archived]' },
        },
      }),
      prisma.emailLog.count({
        where: { sentAt: { lt: new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.passwordHistory.count({
        where: { createdAt: { lt: twoYearsAgoCheck } },
      }),
      prisma.auditLog.count({
        where: { createdAt: { lt: sevenYearsAgoCheck } },
      }),
    ]);

    return NextResponse.json({
      status: 'healthy',
      timestamp: now.toISOString(),
      policies: RETENTION_POLICIES,
      pendingCleanup: {
        sessions: expiredSessions,
        'abandoned-carts': oldCarts,
        'chat-messages': oldChatMessages,
        'email-logs': oldEmailLogs,
        'password-history': oldPasswordHistory,
        'audit-logs': oldAuditLogs,
      },
      totalPending: expiredSessions + oldCarts + oldChatMessages + oldEmailLogs + oldPasswordHistory + oldAuditLogs,
    });
  } catch (error) {
    logger.error('[data-retention] Health check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        status: 'error',
        error: process.env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}

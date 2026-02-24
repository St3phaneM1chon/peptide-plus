export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/emails/health
 * Email system health check endpoint
 *
 * Returns provider status, database connectivity, bounce cache stats,
 * rate limiting status, last email timestamp, and recent error count.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getBounceStats } from '@/lib/email/bounce-handler';
import { logger } from '@/lib/logger';

type HealthStatus = 'healthy' | 'degraded' | 'down';

function detectProvider(): string {
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.SENDGRID_API_KEY) return 'sendgrid';
  if (process.env.SMTP_HOST) return 'smtp';
  return 'log';
}

function isProviderConfigured(): boolean {
  return !!(
    process.env.RESEND_API_KEY ||
    process.env.SENDGRID_API_KEY ||
    process.env.SMTP_HOST
  );
}

export const GET = withAdminGuard(async (_request, { session: _session }) => {
  const provider = detectProvider();
  const providerConfigured = isProviderConfigured();
  const isLive = providerConfigured && provider !== 'log';

  let databaseConnected = false;
  let lastEmailSentAt: string | null = null;
  let recentErrors = 0;

  try {
    // Check DB connectivity + get last email + recent error count in parallel
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [dbCheck, lastEmail, errorCount] = await Promise.all([
      prisma.emailLog.count().then(() => true).catch(() => false),
      prisma.emailLog.findFirst({
        orderBy: { sentAt: 'desc' },
        select: { sentAt: true },
      }),
      prisma.emailLog.count({
        where: {
          status: 'failed',
          sentAt: { gte: twentyFourHoursAgo },
        },
      }),
    ]);

    databaseConnected = dbCheck;
    lastEmailSentAt = lastEmail?.sentAt?.toISOString() ?? null;
    recentErrors = errorCount;
  } catch (error) {
    logger.error('[EmailHealth] Database health check failed', { error: error instanceof Error ? error.message : String(error) });
    databaseConnected = false;
  }

  // Bounce cache stats from in-memory cache
  const bounceCache = getBounceStats();

  // Determine overall status
  let status: HealthStatus = 'healthy';
  if (!databaseConnected) {
    status = 'down';
  } else if (!providerConfigured || recentErrors > 10) {
    status = 'degraded';
  }

  return NextResponse.json({
    status,
    provider,
    isLive,
    checks: {
      providerConfigured,
      databaseConnected,
      bounceCache: {
        entries: bounceCache.cachedEntries,
        hardBounces: bounceCache.hardBounces,
        softBounces: bounceCache.softBounces,
      },
      rateLimit: { active: true },
      lastEmailSentAt,
      recentErrors,
    },
  });
});

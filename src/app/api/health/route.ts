export const dynamic = 'force-dynamic';
/**
 * API HEALTH CHECK
 * Endpoint pour la surveillance et le load balancing
 * Includes database, Redis, Stripe, email, and memory checks.
 *
 * GET /api/health           - Full readiness check (all dependencies)
 * GET /api/health?type=live - Liveness check (app running only)
 * HEAD /api/health          - Lightweight liveness for load balancers
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkEnvironment } from '@/lib/env-check';

interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
  details?: Record<string, unknown>;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  type: 'liveness' | 'readiness';
  checks: HealthCheck[];
}

/**
 * GET /api/health
 * Retourne l'etat de sante de l'application
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const checks: HealthCheck[] = [];

  // Determine check type: liveness (minimal) vs readiness (full)
  const checkType = request.nextUrl.searchParams.get('type');
  const isLiveness = checkType === 'live';

  // Check 1: Application running (always)
  checks.push({
    name: 'application',
    status: 'pass',
    message: 'Application is running',
  });

  // For liveness, return immediately
  if (isLiveness) {
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        type: 'liveness',
        checks,
      } satisfies HealthStatus,
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      },
    );
  }

  // --- Readiness checks below ---

  // Check 2: Environment variables (full validation via env-check)
  const envCheck = checkEnvironment();
  checks.push({
    name: 'environment',
    status: envCheck.status,
    message: envCheck.message,
    details: {
      missingRequired: envCheck.details.missingRequired,
      missingImportant: envCheck.details.missingImportant,
      presentCount: envCheck.details.present.length,
      totalDeclared: envCheck.details.totalDeclared,
    },
  });

  // Check 3: Database connectivity
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({
      name: 'database',
      status: 'pass',
      message: 'Database connection OK',
      duration: Date.now() - dbStart,
    });
  } catch (dbError) {
    const errorMsg = dbError instanceof Error ? dbError.message : 'Unknown error';
    logger.error('Health check: database connectivity failed', { error: errorMsg });
    checks.push({
      name: 'database',
      status: 'fail',
      message: `Database connection failed: ${errorMsg}`,
      duration: Date.now() - dbStart,
    });
  }

  // Check 4: Redis connectivity (optional - only if REDIS_URL is configured)
  if (process.env.REDIS_URL) {
    const redisStart = Date.now();
    let client: InstanceType<typeof import('ioredis').default> | null = null;
    try {
      const Redis = (await import('ioredis')).default;
      client = new Redis(process.env.REDIS_URL, {
        connectTimeout: 3000,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });

      const pingPromise = client.connect().then(() => client!.ping());
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis health check timed out after 5s')), 5000)
      );
      await Promise.race([pingPromise, timeoutPromise]);

      checks.push({
        name: 'redis',
        status: 'pass',
        message: 'Redis connection OK',
        duration: Date.now() - redisStart,
      });
    } catch (redisError) {
      const errorMsg = redisError instanceof Error ? redisError.message : 'Unknown error';
      logger.warn('Health check: Redis connectivity failed', { error: errorMsg });
      checks.push({
        name: 'redis',
        status: 'fail',
        message: `Redis connection failed: ${errorMsg}`,
        duration: Date.now() - redisStart,
      });
    } finally {
      try { await client?.quit(); } catch (cleanupError) {
        logger.warn('[Health] Redis client cleanup error (ignored)', { error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError) });
      }
    }
  } else {
    checks.push({
      name: 'redis',
      status: 'warn',
      message: 'Redis not configured (REDIS_URL missing)',
    });
  }

  // Check 5: Stripe configuration
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  checks.push({
    name: 'stripe',
    status: stripeKey ? 'pass' : 'warn',
    message: stripeKey
      ? `Stripe configured (key: ${stripeKey.substring(0, 7)}...)`
      : 'Stripe not configured (STRIPE_SECRET_KEY missing)',
  });

  // Check 6: Email provider configuration
  const emailProvider = process.env.EMAIL_PROVIDER;
  const smtpFrom = process.env.SMTP_FROM;
  const hasResendKey = !!process.env.RESEND_API_KEY;
  const hasSendGridKey = !!process.env.SENDGRID_API_KEY;
  const hasSmtpHost = !!process.env.SMTP_HOST;

  let emailStatus: 'pass' | 'warn' | 'fail' = 'warn';
  let emailMessage = 'Email provider not configured';

  if (emailProvider === 'resend' && hasResendKey) {
    emailStatus = 'pass';
    emailMessage = 'Email configured via Resend';
  } else if (emailProvider === 'sendgrid' && hasSendGridKey) {
    emailStatus = 'pass';
    emailMessage = 'Email configured via SendGrid';
  } else if (emailProvider === 'smtp' && hasSmtpHost) {
    emailStatus = 'pass';
    emailMessage = 'Email configured via SMTP';
  } else if (emailProvider === 'log') {
    emailStatus = 'warn';
    emailMessage = 'Email in log-only mode (no delivery)';
  }

  checks.push({
    name: 'email',
    status: emailStatus,
    message: emailMessage,
    details: { provider: emailProvider || 'none', from: smtpFrom || 'not set' },
  });

  // Check 7: Memory usage
  const memoryUsage = process.memoryUsage();
  const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const rssLimitMB = 1400; // B1 tier ~1.75GB, fail at 80%

  checks.push({
    name: 'memory',
    status: rssMB < rssLimitMB ? 'pass' : 'fail',
    message: `RSS: ${rssMB}MB, Heap: ${heapUsedMB}MB / ${heapTotalMB}MB`,
  });

  // Check 8: Sentry configuration
  checks.push({
    name: 'sentry',
    status: process.env.SENTRY_DSN ? 'pass' : 'warn',
    message: process.env.SENTRY_DSN
      ? 'Sentry error tracking configured'
      : 'Sentry not configured (SENTRY_DSN missing)',
  });

  // Check 9: Auth configuration (NextAuth)
  const hasNextAuthSecret = !!process.env.NEXTAUTH_SECRET;
  const hasNextAuthUrl = !!process.env.NEXTAUTH_URL;
  checks.push({
    name: 'auth',
    status: hasNextAuthSecret ? 'pass' : 'fail',
    message: hasNextAuthSecret
      ? `Auth configured${hasNextAuthUrl ? '' : ' (NEXTAUTH_URL not set, using default)'}`
      : 'NEXTAUTH_SECRET not set - auth will not work',
    details: {
      hasSecret: hasNextAuthSecret,
      hasUrl: hasNextAuthUrl,
      googleOAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      appleOAuth: !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET),
    },
  });

  // Check 10: CSRF protection configuration
  const csrfSecret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET;
  checks.push({
    name: 'csrf',
    status: csrfSecret && csrfSecret !== 'build-placeholder' ? 'pass' : 'warn',
    message: csrfSecret && csrfSecret !== 'build-placeholder'
      ? 'CSRF protection configured'
      : 'CSRF secret missing or using placeholder - CSRF protection weakened',
  });

  // Determine overall status
  const failedChecks = checks.filter((c) => c.status === 'fail');
  const warnChecks = checks.filter((c) => c.status === 'warn');
  let overallStatus: HealthStatus['status'] = 'healthy';

  if (failedChecks.length > 0) {
    overallStatus = failedChecks.some((c) =>
      ['database', 'application'].includes(c.name)
    )
      ? 'unhealthy'
      : 'degraded';
  } else if (warnChecks.length > 0) {
    overallStatus = 'degraded';
  }

  const healthStatus: HealthStatus & { uptime?: number } = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    type: 'readiness',
    uptime: Math.round(process.uptime()),
    checks: checks.map((check) => ({
      ...check,
      duration: check.duration ?? Date.now() - startTime,
    })),
  };

  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;

  logger.info('Health check completed', {
    status: overallStatus,
    type: 'readiness',
    checks: checks.length,
    failedChecks: failedChecks.length,
    durationMs: Date.now() - startTime,
  });

  return NextResponse.json(healthStatus, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Content-Type': 'application/json',
    },
  });
}

/**
 * HEAD /api/health
 * Version simplifiee pour les load balancers (liveness)
 */
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

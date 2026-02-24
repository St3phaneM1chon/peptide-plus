export const dynamic = 'force-dynamic';

/**
 * EXTERNAL DEPENDENCY MONITORING
 *
 * GET  /api/cron/dependency-check - Check status of all external dependencies
 * POST /api/cron/dependency-check - Run check and store results (cron-triggered)
 *
 * Checks:
 *   - Stripe API (if configured)
 *   - Exchange rate API (open.er-api.com)
 *   - Email provider (Resend/SendGrid config)
 *   - Redis connectivity
 *   - Database connectivity
 *
 * Results are stored in Redis for dashboard consumption.
 * Authentication (POST): Requires CRON_SECRET in Authorization header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getRedisClient, isRedisAvailable } from '@/lib/redis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DependencyStatus {
  name: string;
  status: 'ok' | 'degraded' | 'down' | 'unconfigured';
  responseTimeMs?: number;
  message?: string;
  lastChecked: string;
}

interface DependencyCheckResult {
  overall: 'ok' | 'degraded' | 'down';
  dependencies: DependencyStatus[];
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// Redis storage
// ---------------------------------------------------------------------------

const REDIS_KEY = 'dependency-check:latest';
const REDIS_TTL = 3600; // 1 hour

async function storeResult(result: DependencyCheckResult): Promise<void> {
  if (isRedisAvailable()) {
    try {
      const redis = await getRedisClient();
      if (redis) {
        await redis.set(REDIS_KEY, JSON.stringify(result), 'EX', REDIS_TTL);
      }
    } catch (error) {
      logger.error('[DependencyCheck] Redis store result failed (non-critical)', { error: error instanceof Error ? error.message : String(error) });
    }
  }
}

async function loadLastResult(): Promise<DependencyCheckResult | null> {
  if (isRedisAvailable()) {
    try {
      const redis = await getRedisClient();
      if (redis) {
        const raw = await redis.get(REDIS_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch (error) {
      logger.error('[DependencyCheck] Redis load last result failed, falling through', { error: error instanceof Error ? error.message : String(error) });
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Dependency checks
// ---------------------------------------------------------------------------

async function checkStripe(): Promise<DependencyStatus> {
  const name = 'Stripe API';
  const now = new Date().toISOString();

  if (!process.env.STRIPE_SECRET_KEY) {
    return { name, status: 'unconfigured', message: 'STRIPE_SECRET_KEY not set', lastChecked: now };
  }

  const start = Date.now();
  try {
    // Use Stripe's balance endpoint as a health check (lightweight)
    const response = await fetch('https://api.stripe.com/v1/balance', {
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    const responseTimeMs = Date.now() - start;

    if (response.ok) {
      return { name, status: 'ok', responseTimeMs, lastChecked: now };
    }

    if (response.status === 401) {
      return { name, status: 'down', responseTimeMs, message: 'Invalid API key', lastChecked: now };
    }

    return {
      name,
      status: 'degraded',
      responseTimeMs,
      message: `HTTP ${response.status}`,
      lastChecked: now,
    };
  } catch (err) {
    logger.error('[DependencyCheck] Stripe health check failed', { error: err instanceof Error ? err.message : String(err) });
    const responseTimeMs = Date.now() - start;
    return {
      name,
      status: 'down',
      responseTimeMs,
      message: err instanceof Error ? err.message : 'Connection failed',
      lastChecked: now,
    };
  }
}

async function checkExchangeRateApi(): Promise<DependencyStatus> {
  const name = 'Exchange Rate API';
  const now = new Date().toISOString();
  const start = Date.now();

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/CAD', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    const responseTimeMs = Date.now() - start;

    if (response.ok) {
      const data = await response.json();
      if (data.result === 'success') {
        return { name, status: 'ok', responseTimeMs, lastChecked: now };
      }
      return {
        name,
        status: 'degraded',
        responseTimeMs,
        message: `API result: ${data.result}`,
        lastChecked: now,
      };
    }

    return {
      name,
      status: 'degraded',
      responseTimeMs,
      message: `HTTP ${response.status}`,
      lastChecked: now,
    };
  } catch (err) {
    logger.error('[DependencyCheck] Exchange Rate API health check failed', { error: err instanceof Error ? err.message : String(err) });
    const responseTimeMs = Date.now() - start;
    return {
      name,
      status: 'down',
      responseTimeMs,
      message: err instanceof Error ? err.message : 'Connection failed',
      lastChecked: now,
    };
  }
}

async function checkEmailProvider(): Promise<DependencyStatus> {
  const name = 'Email Provider';
  const now = new Date().toISOString();
  const provider = process.env.EMAIL_PROVIDER || 'log';

  if (provider === 'log') {
    return { name, status: 'ok', message: 'Dev mode (log)', lastChecked: now };
  }

  if (provider === 'resend') {
    if (!process.env.RESEND_API_KEY) {
      return { name, status: 'unconfigured', message: 'RESEND_API_KEY not set', lastChecked: now };
    }

    const start = Date.now();
    try {
      const response = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        signal: AbortSignal.timeout(5000),
      });
      const responseTimeMs = Date.now() - start;

      if (response.ok || response.status === 200) {
        return { name, status: 'ok', responseTimeMs, message: 'Resend', lastChecked: now };
      }
      return {
        name,
        status: 'degraded',
        responseTimeMs,
        message: `Resend HTTP ${response.status}`,
        lastChecked: now,
      };
    } catch (err) {
      logger.error('[DependencyCheck] Email provider (Resend) health check failed', { error: err instanceof Error ? err.message : String(err) });
      const responseTimeMs = Date.now() - start;
      return {
        name,
        status: 'down',
        responseTimeMs,
        message: err instanceof Error ? err.message : 'Connection failed',
        lastChecked: now,
      };
    }
  }

  if (provider === 'sendgrid') {
    if (!process.env.SENDGRID_API_KEY) {
      return { name, status: 'unconfigured', message: 'SENDGRID_API_KEY not set', lastChecked: now };
    }
    return { name, status: 'ok', message: 'SendGrid configured', lastChecked: now };
  }

  return { name, status: 'unconfigured', message: `Unknown provider: ${provider}`, lastChecked: now };
}

async function checkRedis(): Promise<DependencyStatus> {
  const name = 'Redis';
  const now = new Date().toISOString();

  if (!process.env.REDIS_URL) {
    return { name, status: 'unconfigured', message: 'REDIS_URL not set', lastChecked: now };
  }

  const start = Date.now();
  try {
    if (!isRedisAvailable()) {
      return { name, status: 'down', message: 'Client not connected', lastChecked: now };
    }

    const redis = await getRedisClient();
    if (!redis) {
      return { name, status: 'down', message: 'Client is null', lastChecked: now };
    }

    // Simple ping via set/get
    const testKey = 'health:ping';
    await redis.set(testKey, 'pong', 'EX', 10);
    const result = await redis.get(testKey);
    const responseTimeMs = Date.now() - start;

    if (result === 'pong') {
      return { name, status: 'ok', responseTimeMs, lastChecked: now };
    }

    return { name, status: 'degraded', responseTimeMs, message: 'Ping failed', lastChecked: now };
  } catch (err) {
    logger.error('[DependencyCheck] Redis health check failed', { error: err instanceof Error ? err.message : String(err) });
    const responseTimeMs = Date.now() - start;
    return {
      name,
      status: 'down',
      responseTimeMs,
      message: err instanceof Error ? err.message : 'Connection failed',
      lastChecked: now,
    };
  }
}

async function checkDatabase(): Promise<DependencyStatus> {
  const name = 'Database (PostgreSQL)';
  const now = new Date().toISOString();
  const start = Date.now();

  try {
    // Simple query to check DB connectivity
    await prisma.$queryRaw`SELECT 1`;
    const responseTimeMs = Date.now() - start;

    return { name, status: 'ok', responseTimeMs, lastChecked: now };
  } catch (err) {
    logger.error('[DependencyCheck] Database health check failed', { error: err instanceof Error ? err.message : String(err) });
    const responseTimeMs = Date.now() - start;
    return {
      name,
      status: 'down',
      responseTimeMs,
      message: err instanceof Error ? err.message : 'Connection failed',
      lastChecked: now,
    };
  }
}

// ---------------------------------------------------------------------------
// Run all checks
// ---------------------------------------------------------------------------

async function runAllChecks(): Promise<DependencyCheckResult> {
  const dependencies = await Promise.all([
    checkDatabase(),
    checkStripe(),
    checkExchangeRateApi(),
    checkEmailProvider(),
    checkRedis(),
  ]);

  const hasDown = dependencies.some((d) => d.status === 'down');
  const hasDegraded = dependencies.some((d) => d.status === 'degraded');

  let overall: 'ok' | 'degraded' | 'down' = 'ok';
  if (hasDown) overall = 'down';
  else if (hasDegraded) overall = 'degraded';

  return {
    overall,
    dependencies,
    checkedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// GET - Return last check or run a fresh one
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    // Try to return cached result first
    const cached = await loadLastResult();
    if (cached) {
      return NextResponse.json({ ...cached, fromCache: true });
    }

    // No cache, run fresh check
    const result = await runAllChecks();
    await storeResult(result);

    return NextResponse.json({ ...result, fromCache: false });
  } catch (error) {
    logger.error('[dependency-check] Failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Dependency check failed' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST - Run check and store (cron-triggered)
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

  try {
    const result = await runAllChecks();
    await storeResult(result);

    // Log status changes
    const downDeps = result.dependencies.filter((d) => d.status === 'down');
    if (downDeps.length > 0) {
      logger.warn('[dependency-check] Dependencies down', {
        down: downDeps.map((d) => d.name),
      });

      // Trigger alert for down dependencies
      try {
        const { sendAlert } = await import('@/lib/alerting');
        for (const dep of downDeps) {
          await sendAlert('warning', `External dependency down: ${dep.name}`, {
            context: { dependency: dep.name, message: dep.message },
          });
        }
      } catch (error) {
        logger.error('[DependencyCheck] Alerting for down dependencies failed (best-effort)', { error: error instanceof Error ? error.message : String(error) });
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('[dependency-check] Check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Dependency check failed' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
/**
 * API HEALTH CHECK
 * Endpoint pour la surveillance et le load balancing
 * Includes database and Redis connectivity checks
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkEnvironment } from '@/lib/env-check';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    duration?: number;
    details?: Record<string, unknown>;
  }[];
}

/**
 * GET /api/health
 * Retourne l'etat de sante de l'application
 */
export async function GET() {
  const startTime = Date.now();
  const checks: HealthStatus['checks'] = [];

  // Check 1: Application running
  checks.push({
    name: 'application',
    status: 'pass',
    message: 'Application is running',
  });

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
    try {
      const Redis = (await import('ioredis')).default;
      const client = new Redis(process.env.REDIS_URL, {
        connectTimeout: 3000,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });

      await client.connect();
      await client.ping();
      await client.quit();

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
    }
  }

  // Check 5: Memory usage (RSS is more meaningful than heap % for Node.js)
  const memoryUsage = process.memoryUsage();
  const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  // B1 tier has ~1.75GB, fail at 80% of that
  const rssLimitMB = 1400;

  checks.push({
    name: 'memory',
    status: rssMB < rssLimitMB ? 'pass' : 'fail',
    message: `RSS: ${rssMB}MB, Heap: ${heapUsedMB}MB / ${heapTotalMB}MB`,
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

  const healthStatus: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks: checks.map((check) => ({
      ...check,
      duration: check.duration ?? Date.now() - startTime,
    })),
  };

  // HTTP Status based on health
  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;

  logger.info('Health check completed', {
    status: overallStatus,
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
 * Version simplifiee pour les load balancers
 */
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

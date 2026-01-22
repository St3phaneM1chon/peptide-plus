export const dynamic = 'force-dynamic';
/**
 * API HEALTH CHECK
 * Endpoint pour la surveillance et le load balancing
 */

import { NextResponse } from 'next/server';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    name: string;
    status: 'pass' | 'fail';
    message?: string;
    duration?: number;
  }[];
}

/**
 * GET /api/health
 * Retourne l'état de santé de l'application
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

  // Check 2: Environment variables
  const requiredEnvVars = [
    'AZURE_AD_CLIENT_ID',
    'AZURE_AD_TENANT_ID',
  ];

  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  checks.push({
    name: 'environment',
    status: missingEnvVars.length === 0 ? 'pass' : 'fail',
    message:
      missingEnvVars.length === 0
        ? 'All required environment variables are set'
        : `Missing: ${missingEnvVars.join(', ')}`,
  });

  // Check 3: Memory usage
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const memoryPercent = (heapUsedMB / heapTotalMB) * 100;

  checks.push({
    name: 'memory',
    status: memoryPercent < 90 ? 'pass' : 'fail',
    message: `Heap: ${heapUsedMB}MB / ${heapTotalMB}MB (${memoryPercent.toFixed(1)}%)`,
  });

  // Déterminer le statut global
  const failedChecks = checks.filter((c) => c.status === 'fail');
  let overallStatus: HealthStatus['status'] = 'healthy';

  if (failedChecks.length > 0) {
    overallStatus = failedChecks.some((c) => 
      ['database', 'application'].includes(c.name)
    )
      ? 'unhealthy'
      : 'degraded';
  }

  const healthStatus: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks: checks.map((check) => ({
      ...check,
      duration: Date.now() - startTime,
    })),
  };

  // HTTP Status basé sur l'état de santé
  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;

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
 * Version simplifiée pour les load balancers
 */
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

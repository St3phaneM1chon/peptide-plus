export const dynamic = 'force-dynamic';

/**
 * Network Diagnostics API
 * Runs ping, DNS, download speed, and endpoint health checks.
 * Admin-only — requires EMPLOYEE or OWNER role.
 */

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';

interface DiagnosticResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  value?: string;
  details?: string;
  durationMs?: number;
}

interface NetworkDiagnostics {
  timestamp: string;
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  checks: DiagnosticResult[];
  summary: {
    passed: number;
    warnings: number;
    failed: number;
  };
}

async function checkEndpoint(url: string, label: string, timeoutMs = 10000): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);
    const duration = Date.now() - start;

    if (res.ok) {
      return {
        name: label,
        status: duration > 5000 ? 'warn' : 'pass',
        value: `HTTP ${res.status}`,
        details: duration > 5000 ? 'Slow response' : 'OK',
        durationMs: duration,
      };
    }
    return {
      name: label,
      status: 'fail',
      value: `HTTP ${res.status}`,
      details: res.statusText,
      durationMs: duration,
    };
  } catch (err) {
    return {
      name: label,
      status: 'fail',
      value: 'Error',
      details: err instanceof Error ? err.message : 'Connection failed',
      durationMs: Date.now() - start,
    };
  }
}

async function checkDownloadSpeed(url: string, label: string, sizeBytes: number): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);

    if (!res.ok || !res.body) {
      return { name: label, status: 'fail', value: 'Error', details: `HTTP ${res.status}` };
    }

    // Read the full response to measure speed
    const reader = res.body.getReader();
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.length;
    }

    const duration = Date.now() - start;
    const speedBps = (totalBytes * 8) / (duration / 1000);
    const speedMbps = speedBps / 1_000_000;

    let status: 'pass' | 'warn' | 'fail' = 'pass';
    if (speedMbps < 2) status = 'fail';
    else if (speedMbps < 10) status = 'warn';

    return {
      name: label,
      status,
      value: `${speedMbps.toFixed(1)} Mbps`,
      details: `${(totalBytes / 1_048_576).toFixed(1)} MB in ${(duration / 1000).toFixed(1)}s`,
      durationMs: duration,
    };
  } catch (err) {
    return {
      name: label,
      status: 'fail',
      value: 'Error',
      details: err instanceof Error ? err.message : 'Download failed',
      durationMs: Date.now() - start,
    };
  }
}

async function checkDNS(hostname: string): Promise<DiagnosticResult> {
  const start = Date.now();
  try {
    // Use a simple fetch to the hostname to test DNS resolution
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    await fetch(`https://${hostname}`, {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);
    const duration = Date.now() - start;

    return {
      name: `DNS: ${hostname}`,
      status: duration > 1000 ? 'warn' : 'pass',
      value: `${duration}ms`,
      details: 'Resolved',
      durationMs: duration,
    };
  } catch (err) {
    const duration = Date.now() - start;
    // DNS-level failure vs timeout
    const msg = err instanceof Error ? err.message : 'Unknown';
    if (msg.includes('abort')) {
      return { name: `DNS: ${hostname}`, status: 'fail', value: 'Timeout', durationMs: duration };
    }
    // Even a non-2xx still means DNS resolved
    return {
      name: `DNS: ${hostname}`,
      status: duration > 2000 ? 'warn' : 'pass',
      value: `${duration}ms`,
      details: 'Resolved (non-2xx)',
      durationMs: duration,
    };
  }
}

export const GET = withAdminGuard(async () => {
  const checks: DiagnosticResult[] = [];

  // Run checks in parallel groups
  // Group 1: DNS resolution
  const dnsChecks = await Promise.all([
    checkDNS('biocyclepeptides.com'),
    checkDNS('github.com'),
    checkDNS('login.microsoftonline.com'),
  ]);
  checks.push(...dnsChecks);

  // Group 2: Endpoint health
  const endpointChecks = await Promise.all([
    checkEndpoint('https://biocyclepeptides.com/api/health?type=live', 'Production Health'),
    checkEndpoint('https://api.github.com/rate_limit', 'GitHub API'),
    checkEndpoint('https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration', 'Azure AD'),
    checkEndpoint('https://accounts.google.com/.well-known/openid-configuration', 'Google OAuth'),
  ]);
  checks.push(...endpointChecks);

  // Group 3: Download speed (sequential to avoid contention)
  const dl1MB = await checkDownloadSpeed(
    'https://speed.cloudflare.com/__down?bytes=1048576',
    'Download 1 MB',
    1_048_576,
  );
  checks.push(dl1MB);

  const dl10MB = await checkDownloadSpeed(
    'https://speed.cloudflare.com/__down?bytes=10485760',
    'Download 10 MB',
    10_485_760,
  );
  checks.push(dl10MB);

  // Summary
  const passed = checks.filter(c => c.status === 'pass').length;
  const warnings = checks.filter(c => c.status === 'warn').length;
  const failed = checks.filter(c => c.status === 'fail').length;

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (failed > 0) overallStatus = 'unhealthy';
  else if (warnings > 0) overallStatus = 'degraded';

  const result: NetworkDiagnostics = {
    timestamp: new Date().toISOString(),
    overallStatus,
    checks,
    summary: { passed, warnings, failed },
  };

  return NextResponse.json(result);
});

#!/usr/bin/env npx tsx
/**
 * CLI script to run all 39 audits and report results.
 * Usage: npx tsx scripts/run-all-audits-cli.ts
 */

import { runAudit } from '../src/lib/audit-engine';

async function main() {
  const codes = [
    'AUTH-SESSION', 'AUTHZ-RBAC', 'INPUT-INJECTION', 'CSRF-RATELIMIT',
    'SECRETS-ENV', 'PAYMENT-PCI', 'ACCOUNTING-INTEGRITY', 'TAX-ACCURACY',
    'PRIVACY-COMPLIANCE', 'DB-INTEGRITY', 'RACE-CONDITIONS', 'API-LEAKAGE',
    'DB-PERFORMANCE', 'WEBHOOK-IDEMPOTENCY', 'CRON-RELIABILITY', 'EMAIL-CASL',
    'I18N-COMPLETENESS', 'WEBAUTHN-MFA', 'SECURITY-HEADERS',
    'TYPESCRIPT-QUALITY', 'FRONTEND-PERFORMANCE', 'ERROR-OBSERVABILITY',
    'ARCHITECTURE-QUALITY', 'ACCESSIBILITY-WCAG', 'API-CONTRACTS',
    'AZURE-LOCAL-SYNC', 'ADMIN-BACKEND-MEGA',
    'SECTION-DASHBOARD', 'SECTION-COMMERCE', 'SECTION-CATALOG',
    'SECTION-MARKETING', 'SECTION-COMMUNITY', 'SECTION-LOYALTY',
    'SECTION-MEDIA', 'SECTION-EMAILS', 'SECTION-TELEPHONY',
    'SECTION-CRM', 'SECTION-ACCOUNTING', 'SECTION-SYSTEM',
  ];

  console.log(`Running ${codes.length} audits...\n`);

  const results: { code: string; findings: number; passed: number; status: string }[] = [];
  let totalFindings = 0;

  for (const code of codes) {
    try {
      const r = await runAudit(code, 'cli-script');
      results.push({ code, findings: r.findingsCount, passed: r.passedChecks, status: 'OK' });
      totalFindings += r.findingsCount;
      console.log(`  ✓ ${code}: ${r.findingsCount} findings, ${r.passedChecks} passed`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ code, findings: 0, passed: 0, status: `FAIL: ${msg}` });
      console.log(`  ✗ ${code}: FAILED - ${msg}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`TOTAL: ${totalFindings} findings across ${codes.length} audits`);

  // Severity breakdown (placeholder for future per-finding breakdown)
  for (const r of results) {
    if (r.status === 'OK') {
      // We can't get severity from here, but we logged the count
    }
  }

  console.log(`Completed: ${results.filter(r => r.status === 'OK').length}`);
  console.log(`Failed: ${results.filter(r => r.status !== 'OK').length}`);
  console.log(`${'='.repeat(60)}`);
}

main().catch(console.error);

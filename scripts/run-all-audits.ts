/**
 * Run all 25 audits directly (bypasses API auth)
 * Usage: npx tsx scripts/run-all-audits.ts [--critical-only] [--code AUTH-SESSION]
 */

import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

// We can't use @/ path aliases here, so we import auditors directly
const AUDITORS_DIR = path.join(__dirname, '..', 'src', 'lib', 'auditors');

interface AuditCheckResult {
  checkId: string;
  passed: boolean;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  title: string;
  description: string;
  filePath?: string;
  lineNumber?: number;
  codeSnippet?: string;
  recommendation?: string;
  functionId?: string;
}

const ALL_CODES = [
  // CRITICAL
  'AUTH-SESSION', 'AUTHZ-RBAC', 'INPUT-INJECTION', 'CSRF-RATELIMIT', 'SECRETS-ENV',
  'PAYMENT-PCI', 'ACCOUNTING-INTEGRITY', 'TAX-ACCURACY', 'PRIVACY-COMPLIANCE', 'DB-INTEGRITY',
  // HIGH
  'RACE-CONDITIONS', 'API-LEAKAGE', 'DB-PERFORMANCE', 'WEBHOOK-IDEMPOTENCY', 'CRON-RELIABILITY',
  'EMAIL-CASL', 'I18N-COMPLETENESS', 'WEBAUTHN-MFA', 'SECURITY-HEADERS',
  'AZURE-LOCAL-SYNC', 'ADMIN-BACKEND-MEGA',
  // MEDIUM
  'TYPESCRIPT-QUALITY', 'FRONTEND-PERFORMANCE', 'ERROR-OBSERVABILITY', 'ARCHITECTURE-QUALITY', 'ACCESSIBILITY-WCAG',
  // LOW
  'API-CONTRACTS',
];

const CODE_TO_FILE: Record<string, string> = {
  'AUTH-SESSION': 'auth-session',
  'AUTHZ-RBAC': 'authz-rbac',
  'INPUT-INJECTION': 'input-injection',
  'CSRF-RATELIMIT': 'csrf-ratelimit',
  'SECRETS-ENV': 'secrets-env',
  'PAYMENT-PCI': 'payment-pci',
  'ACCOUNTING-INTEGRITY': 'accounting-integrity',
  'TAX-ACCURACY': 'tax-accuracy',
  'PRIVACY-COMPLIANCE': 'privacy-compliance',
  'DB-INTEGRITY': 'db-integrity',
  'RACE-CONDITIONS': 'race-conditions',
  'API-LEAKAGE': 'api-leakage',
  'DB-PERFORMANCE': 'db-performance',
  'WEBHOOK-IDEMPOTENCY': 'webhook-idempotency',
  'CRON-RELIABILITY': 'cron-reliability',
  'EMAIL-CASL': 'email-casl',
  'I18N-COMPLETENESS': 'i18n-completeness',
  'WEBAUTHN-MFA': 'webauthn-mfa',
  'SECURITY-HEADERS': 'security-headers',
  'TYPESCRIPT-QUALITY': 'typescript-quality',
  'FRONTEND-PERFORMANCE': 'frontend-performance',
  'ERROR-OBSERVABILITY': 'error-observability',
  'ARCHITECTURE-QUALITY': 'architecture-quality',
  'ACCESSIBILITY-WCAG': 'accessibility-wcag',
  'API-CONTRACTS': 'api-contracts',
  'AZURE-LOCAL-SYNC': 'azure-local-sync',
  'ADMIN-BACKEND-MEGA': 'admin-backend-mega',
};

async function runSingleAudit(code: string): Promise<{
  code: string;
  findings: number;
  passed: number;
  failed: number;
  duration: number;
  results: AuditCheckResult[];
}> {
  const fileName = CODE_TO_FILE[code];
  if (!fileName) throw new Error(`Unknown audit code: ${code}`);

  const filePath = path.join(AUDITORS_DIR, `${fileName}.ts`);
  if (!fs.existsSync(filePath)) {
    // Try .js
    const jsPath = path.join(AUDITORS_DIR, `${fileName}.js`);
    if (!fs.existsSync(jsPath)) throw new Error(`Auditor file not found: ${filePath}`);
  }

  const startTime = Date.now();

  // Dynamic import of the auditor
  const mod = require(filePath);
  const AuditorClass = mod.default || mod;
  const auditor = new AuditorClass();
  const results: AuditCheckResult[] = await auditor.run();

  const duration = Date.now() - startTime;
  const findings = results.filter(r => !r.passed);
  const passed = results.filter(r => r.passed);

  // Save to database
  const auditType = await prisma.auditType.findUnique({ where: { code } });
  if (auditType) {
    const run = await prisma.auditRun.create({
      data: {
        auditTypeId: auditType.id,
        status: 'COMPLETED',
        completedAt: new Date(),
        totalChecks: results.length,
        passedChecks: passed.length,
        failedChecks: findings.length,
        findingsCount: findings.length,
        durationMs: duration,
        runBy: 'cli-runner',
        summary: JSON.stringify({
          totalResults: results.length,
          passed: passed.length,
          failed: findings.length,
          bySeverity: {
            CRITICAL: findings.filter(f => f.severity === 'CRITICAL').length,
            HIGH: findings.filter(f => f.severity === 'HIGH').length,
            MEDIUM: findings.filter(f => f.severity === 'MEDIUM').length,
            LOW: findings.filter(f => f.severity === 'LOW').length,
            INFO: findings.filter(f => f.severity === 'INFO').length,
          },
        }),
      },
    });

    // Save findings
    for (const finding of findings) {
      await prisma.auditFinding.create({
        data: {
          auditRunId: run.id,
          checkId: finding.checkId,
          severity: finding.severity,
          title: finding.title,
          description: finding.description,
          filePath: finding.filePath,
          lineNumber: finding.lineNumber,
          codeSnippet: finding.codeSnippet?.substring(0, 2000),
          recommendation: finding.recommendation,
        },
      });
    }
  }

  return { code, findings: findings.length, passed: passed.length, failed: findings.length, duration, results };
}

async function main() {
  const args = process.argv.slice(2);
  const criticalOnly = args.includes('--critical-only');
  const singleCode = args.find(a => a !== '--critical-only' && !a.startsWith('--'))?.toUpperCase();

  let codes = ALL_CODES;
  if (singleCode) {
    codes = [singleCode];
  } else if (criticalOnly) {
    codes = ALL_CODES.slice(0, 10);
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  BIOCYCLE PEPTIDES - CODE AUDIT RUNNER`);
  console.log(`  Running ${codes.length} audit(s)...`);
  console.log(`${'═'.repeat(60)}\n`);

  const allResults: Array<{ code: string; findings: number; passed: number; failed: number; duration: number }> = [];
  let totalFindings = 0;
  let totalPassed = 0;

  for (const code of codes) {
    process.stdout.write(`▶ ${code.padEnd(25)} `);
    try {
      const result = await runSingleAudit(code);
      totalFindings += result.findings;
      totalPassed += result.passed;
      allResults.push(result);

      const status = result.findings === 0 ? '✅ PASS' : `⚠️  ${result.findings} findings`;
      console.log(`${status.padEnd(20)} (${result.passed} passed, ${result.duration}ms)`);

      // Show critical/high findings inline
      if (result.findings > 0) {
        const criticalFindings = result.results.filter(r => !r.passed && (r.severity === 'CRITICAL' || r.severity === 'HIGH'));
        for (const f of criticalFindings.slice(0, 3)) {
          console.log(`   └─ [${f.severity}] ${f.title}${f.filePath ? ` → ${f.filePath}` : ''}`);
        }
        if (criticalFindings.length > 3) {
          console.log(`   └─ ... and ${criticalFindings.length - 3} more`);
        }
      }
    } catch (err) {
      console.log(`❌ ERROR: ${err instanceof Error ? err.message : err}`);
      allResults.push({ code, findings: -1, passed: 0, failed: -1, duration: 0 });
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  AUDIT SUMMARY`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`  Audits run:       ${allResults.length}`);
  console.log(`  Total checks:     ${totalPassed + totalFindings}`);
  console.log(`  Passed:           ${totalPassed}`);
  console.log(`  Findings:         ${totalFindings}`);
  console.log(`  Errors:           ${allResults.filter(r => r.findings === -1).length}`);
  console.log(`${'─'.repeat(60)}`);

  // By severity group
  const bySeverity: Record<string, typeof allResults> = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };
  for (const r of allResults) {
    const type = ALL_CODES.indexOf(r.code);
    if (type < 10) bySeverity.CRITICAL.push(r);
    else if (type < 21) bySeverity.HIGH.push(r);
    else if (type < 26) bySeverity.MEDIUM.push(r);
    else bySeverity.LOW.push(r);
  }

  for (const [sev, results] of Object.entries(bySeverity)) {
    if (results.length === 0) continue;
    const findings = results.reduce((s, r) => s + Math.max(0, r.findings), 0);
    const passed = results.filter(r => r.findings === 0).length;
    console.log(`  ${sev.padEnd(10)} ${results.length} audits | ${passed} clean | ${findings} findings`);
  }

  console.log(`${'═'.repeat(60)}\n`);
}

main()
  .catch(e => { console.error('\nFatal error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

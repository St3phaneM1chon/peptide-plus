/**
 * Core Audit Engine
 * Manages audit runs: creates records, delegates to auditors, aggregates findings.
 */

import { prisma } from '@/lib/db';

export interface AuditCheckResult {
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

export interface Auditor {
  auditTypeCode: string;
  run(): Promise<AuditCheckResult[]>;
}

/**
 * Run an audit by type code.
 * Creates an AuditRun, executes the auditor, saves findings, and marks complete.
 */
export async function runAudit(
  auditTypeCode: string,
  runBy?: string
): Promise<{ runId: string; findingsCount: number; passedChecks: number; failedChecks: number }> {
  // Find the audit type
  const auditType = await prisma.auditType.findUnique({
    where: { code: auditTypeCode },
  });
  if (!auditType) {
    throw new Error(`Audit type not found: ${auditTypeCode}`);
  }

  const checklist = JSON.parse(auditType.checklist) as { id: string }[];
  const startTime = Date.now();

  // Create audit run
  const run = await prisma.auditRun.create({
    data: {
      auditTypeId: auditType.id,
      status: 'RUNNING',
      totalChecks: checklist.length,
      runBy,
    },
  });

  try {
    // Dynamically load the auditor
    const auditor = await loadAuditor(auditTypeCode);
    const results = await auditor.run();

    // Save findings
    const findings = results.filter((r) => !r.passed);
    const passed = results.filter((r) => r.passed);

    for (const finding of findings) {
      await prisma.auditFinding.create({
        data: {
          auditRunId: run.id,
          functionId: finding.functionId || null,
          checkId: finding.checkId,
          severity: finding.severity,
          title: finding.title,
          description: finding.description,
          filePath: finding.filePath,
          lineNumber: finding.lineNumber,
          codeSnippet: finding.codeSnippet,
          recommendation: finding.recommendation,
        },
      });
    }

    // Update run status
    const durationMs = Date.now() - startTime;
    await prisma.auditRun.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        passedChecks: passed.length,
        failedChecks: findings.length,
        findingsCount: findings.length,
        durationMs,
        summary: JSON.stringify({
          totalResults: results.length,
          passed: passed.length,
          failed: findings.length,
          bySeverity: {
            CRITICAL: findings.filter((f) => f.severity === 'CRITICAL').length,
            HIGH: findings.filter((f) => f.severity === 'HIGH').length,
            MEDIUM: findings.filter((f) => f.severity === 'MEDIUM').length,
            LOW: findings.filter((f) => f.severity === 'LOW').length,
            INFO: findings.filter((f) => f.severity === 'INFO').length,
          },
        }),
      },
    });

    return {
      runId: run.id,
      findingsCount: findings.length,
      passedChecks: passed.length,
      failedChecks: findings.length,
    };
  } catch (error) {
    // Mark run as failed
    await prisma.auditRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        summary: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      },
    });
    throw error;
  }
}

/**
 * Dynamic auditor loader - maps audit type codes to auditor modules
 */
async function loadAuditor(code: string): Promise<Auditor> {
  // Map code to module path
  const auditorMap: Record<string, () => Promise<{ default: new () => Auditor }>> = {
    'AUTH-SESSION': () => import('@/lib/auditors/auth-session'),
    'AUTHZ-RBAC': () => import('@/lib/auditors/authz-rbac'),
    'INPUT-INJECTION': () => import('@/lib/auditors/input-injection'),
    'CSRF-RATELIMIT': () => import('@/lib/auditors/csrf-ratelimit'),
    'SECRETS-ENV': () => import('@/lib/auditors/secrets-env'),
    'PAYMENT-PCI': () => import('@/lib/auditors/payment-pci'),
    'ACCOUNTING-INTEGRITY': () => import('@/lib/auditors/accounting-integrity'),
    'TAX-ACCURACY': () => import('@/lib/auditors/tax-accuracy'),
    'PRIVACY-COMPLIANCE': () => import('@/lib/auditors/privacy-compliance'),
    'DB-INTEGRITY': () => import('@/lib/auditors/db-integrity'),
    'RACE-CONDITIONS': () => import('@/lib/auditors/race-conditions'),
    'API-LEAKAGE': () => import('@/lib/auditors/api-leakage'),
    'DB-PERFORMANCE': () => import('@/lib/auditors/db-performance'),
    'WEBHOOK-IDEMPOTENCY': () => import('@/lib/auditors/webhook-idempotency'),
    'CRON-RELIABILITY': () => import('@/lib/auditors/cron-reliability'),
    'EMAIL-CASL': () => import('@/lib/auditors/email-casl'),
    'I18N-COMPLETENESS': () => import('@/lib/auditors/i18n-completeness'),
    'WEBAUTHN-MFA': () => import('@/lib/auditors/webauthn-mfa'),
    'SECURITY-HEADERS': () => import('@/lib/auditors/security-headers'),
    'TYPESCRIPT-QUALITY': () => import('@/lib/auditors/typescript-quality'),
    'FRONTEND-PERFORMANCE': () => import('@/lib/auditors/frontend-performance'),
    'ERROR-OBSERVABILITY': () => import('@/lib/auditors/error-observability'),
    'ARCHITECTURE-QUALITY': () => import('@/lib/auditors/architecture-quality'),
    'ACCESSIBILITY-WCAG': () => import('@/lib/auditors/accessibility-wcag'),
    'API-CONTRACTS': () => import('@/lib/auditors/api-contracts'),
    'AZURE-LOCAL-SYNC': () => import('@/lib/auditors/azure-local-sync'),
    'ADMIN-BACKEND-MEGA': () => import('@/lib/auditors/admin-backend-mega'),
  };

  const loader = auditorMap[code];
  if (!loader) {
    throw new Error(`No auditor found for code: ${code}`);
  }

  const mod = await loader();
  return new mod.default();
}

/**
 * Get audit dashboard summary
 */
export async function getAuditDashboard() {
  const auditTypes = await prisma.auditType.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      runs: {
        orderBy: { startedAt: 'desc' },
        take: 1,
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          findingsCount: true,
          passedChecks: true,
          failedChecks: true,
          durationMs: true,
        },
      },
    },
  });

  return auditTypes.map((at) => ({
    id: at.id,
    code: at.code,
    name: at.name,
    nameFr: at.nameFr,
    description: at.description,
    descriptionFr: at.descriptionFr,
    severity: at.severity,
    category: at.category,
    checklistCount: (JSON.parse(at.checklist) as unknown[]).length,
    lastRun: at.runs[0] || null,
  }));
}

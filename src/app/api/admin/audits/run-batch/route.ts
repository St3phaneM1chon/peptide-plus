/**
 * POST /api/admin/audits/run-batch - Launch multiple audits sequentially
 * Body: { auditIds?: string[], severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "ALL" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { runAudit } from '@/lib/audit-engine';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface BatchResult {
  code: string;
  runId: string;
  findingsCount: number;
  passedChecks: number;
  failedChecks: number;
  status: 'COMPLETED' | 'FAILED';
  error?: string;
}

export const POST = withAdminGuard(async (request: NextRequest, context: { session: { user?: { email?: string } } }) => {
  const body = await request.json();
  const { auditIds, severity } = body as { auditIds?: string[]; severity?: string };

  if (!auditIds && !severity) {
    return NextResponse.json(
      { error: 'Either auditIds or severity is required' },
      { status: 400 }
    );
  }

  let codes: string[] = [];

  if (auditIds && auditIds.length > 0) {
    // Run specific audits by code
    codes = auditIds;
  } else if (severity) {
    // Fetch audit types by severity
    const where = severity === 'ALL'
      ? { isActive: true }
      : { severity: severity.toUpperCase(), isActive: true };

    const types = await prisma.auditType.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      select: { code: true },
    });
    codes = types.map((t) => t.code);
  }

  if (codes.length === 0) {
    return NextResponse.json(
      { error: 'No audit types found matching criteria' },
      { status: 404 }
    );
  }

  const userEmail = context.session?.user?.email || 'system';
  logger.info(`Starting batch audit run: ${codes.length} audits`, { codes, severity, user: userEmail });

  const results: BatchResult[] = [];
  let totalFindings = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  for (const code of codes) {
    try {
      const result = await runAudit(code, userEmail);
      results.push({
        code,
        runId: result.runId,
        findingsCount: result.findingsCount,
        passedChecks: result.passedChecks,
        failedChecks: result.failedChecks,
        status: 'COMPLETED',
      });
      totalFindings += result.findingsCount;
      totalPassed += result.passedChecks;
      totalFailed += result.failedChecks;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Batch audit failed for ${code}`, { error: errMsg });
      results.push({
        code,
        runId: '',
        findingsCount: 0,
        passedChecks: 0,
        failedChecks: 0,
        status: 'FAILED',
        error: errMsg,
      });
    }
  }

  const completed = results.filter((r) => r.status === 'COMPLETED').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;

  logger.info(`Batch audit completed: ${completed}/${codes.length} succeeded`, {
    totalFindings,
    totalPassed,
    totalFailed,
    failedAudits: failed,
  });

  return NextResponse.json({
    data: {
      totalAudits: codes.length,
      completed,
      failed,
      totalFindings,
      totalPassed,
      totalFailed,
      results,
    },
  }, { status: 201 });
});

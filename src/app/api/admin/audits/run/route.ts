/**
 * POST /api/admin/audits/run - Launch an audit run
 * Body: { auditTypeCode: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { runAudit } from '@/lib/audit-engine';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const runAuditSchema = z.object({
  auditTypeCode: z.string().min(1, 'auditTypeCode is required').max(100),
});

export const POST = withAdminGuard(async (request: NextRequest, context: { session: { user: { id: string; email?: string | null } } }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = runAuditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { auditTypeCode } = parsed.data;

  try {
    logger.info(`Starting audit run: ${auditTypeCode}`, { auditTypeCode, user: context.session?.user?.email });

    const result = await runAudit(auditTypeCode, context.session?.user?.email || 'system');

    logger.info(`Audit completed: ${auditTypeCode}`, { ...result });

    logAdminAction({
      adminUserId: context.session.user.id,
      action: 'RUN_AUDIT',
      targetType: 'AuditRun',
      targetId: result.runId,
      newValue: { auditTypeCode, findingsCount: result.findingsCount, passedChecks: result.passedChecks, failedChecks: result.failedChecks },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    logger.error(`Audit failed: ${auditTypeCode}`, { error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Audit run failed' },
      { status: 500 }
    );
  }
});

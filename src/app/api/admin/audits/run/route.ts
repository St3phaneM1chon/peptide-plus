/**
 * POST /api/admin/audits/run - Launch an audit run
 * Body: { auditTypeCode: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { runAudit } from '@/lib/audit-engine';
import { logger } from '@/lib/logger';

export const POST = withAdminGuard(async (request: NextRequest, context: { session: { user?: { email?: string } } }) => {
  const body = await request.json();
  const { auditTypeCode } = body;

  if (!auditTypeCode || typeof auditTypeCode !== 'string') {
    return NextResponse.json({ error: 'auditTypeCode is required' }, { status: 400 });
  }

  try {
    logger.info(`Starting audit run: ${auditTypeCode}`, { auditTypeCode, user: context.session?.user?.email });

    const result = await runAudit(auditTypeCode, context.session?.user?.email || 'system');

    logger.info(`Audit completed: ${auditTypeCode}`, { ...result });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    logger.error(`Audit failed: ${auditTypeCode}`, { error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Audit run failed' },
      { status: 500 }
    );
  }
});

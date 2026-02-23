export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { runMonthEndChecklist, lockPeriod } from '@/lib/accounting/period-close.service';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async (_request, { session, params }) => {
  try {
    const code = params?.code;

    if (!code) {
      return NextResponse.json({ error: 'Code de période requis' }, { status: 400 });
    }

    const checklist = await runMonthEndChecklist(code);

    // Audit log for checklist execution
    const errors = checklist.filter((item) => item.status === 'error');
    const warnings = checklist.filter((item) => item.status === 'warning');
    logger.info('Period checklist executed:', {
      periodCode: code,
      executedBy: session.user.id || session.user.email,
      totalChecks: checklist.length,
      passed: checklist.filter((item) => item.status === 'ok').length,
      warnings: warnings.length,
      errors: errors.length,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ code, checklist });
  } catch (error) {
    logger.error('Error running checklist', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request, { session, params }) => {
  try {
    const code = params?.code;

    if (!code) {
      return NextResponse.json({ error: 'Code de période requis' }, { status: 400 });
    }

    const closedBy = session.user?.id || session.user?.email || 'system';

    await lockPeriod(code, closedBy);

    return NextResponse.json({ success: true, code, status: 'LOCKED' });
  } catch (error) {
    logger.error('Error locking period', { error: error instanceof Error ? error.message : String(error) });
    // #87 Error Recovery: Return 500 for unexpected errors, 400 for validation
    const rawMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
    const isValidationError = rawMessage.includes('not found') ||
      rawMessage.includes('already locked') ||
      rawMessage.includes('Impossible de verrouiller') ||
      rawMessage.includes('Cannot lock');
    const message = isValidationError
      ? rawMessage
      : (process.env.NODE_ENV === 'development' ? rawMessage : 'Une erreur est survenue');
    return NextResponse.json(
      { error: message },
      { status: isValidationError ? 400 : 500 }
    );
  }
});

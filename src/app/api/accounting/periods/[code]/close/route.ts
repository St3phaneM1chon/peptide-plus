export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { runMonthEndChecklist, lockPeriod } from '@/lib/accounting/period-close.service';

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
    console.info('Period checklist executed:', {
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
    console.error('Error running checklist:', error);
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request, { params }) => {
  try {
    const code = params?.code;

    if (!code) {
      return NextResponse.json({ error: 'Code de période requis' }, { status: 400 });
    }

    const body = await request.json();
    const { closedBy = 'system' } = body;

    await lockPeriod(code, closedBy);

    return NextResponse.json({ success: true, code, status: 'LOCKED' });
  } catch (error) {
    console.error('Error locking period:', error);
    // #87 Error Recovery: Return 500 for unexpected errors, 400 for validation
    const message = error instanceof Error ? error.message : 'Une erreur est survenue';
    const isValidationError = message.includes('not found') ||
      message.includes('already locked') ||
      message.includes('Impossible de verrouiller') ||
      message.includes('Cannot lock');
    return NextResponse.json(
      { error: message },
      { status: isValidationError ? 400 : 500 }
    );
  }
});

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { runMonthEndChecklist, lockPeriod } from '@/lib/accounting/period-close.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { code } = await params;
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
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { code } = await params;
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
}

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { runYearEndClose } from '@/lib/accounting/period-close.service';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { year, closedBy = 'system' } = body;

    if (!year) {
      return NextResponse.json({ error: 'year is required' }, { status: 400 });
    }

    const result = await runYearEndClose(year, closedBy);

    return NextResponse.json({
      success: true,
      year,
      netIncome: result.netIncome,
      closingEntryId: result.closingEntryId,
      periodsCreated: result.periodsCreated,
    });
  } catch (error) {
    console.error('Error running year-end close:', error);
    // #86 Error Recovery: Distinguish 400 (validation) from 500 (server) errors
    const message = error instanceof Error ? error.message : 'Une erreur est survenue';
    const isValidationError = message.includes('not locked') ||
      message.includes('not found') ||
      message.includes('Only') ||
      message.includes('Cannot close');
    return NextResponse.json(
      { error: message },
      { status: isValidationError ? 400 : 500 }
    );
  }
}

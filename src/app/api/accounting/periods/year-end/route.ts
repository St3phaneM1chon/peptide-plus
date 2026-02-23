export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { runYearEndClose } from '@/lib/accounting/period-close.service';
import { logger } from '@/lib/logger';

export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const { year } = body;

    if (!year) {
      return NextResponse.json({ error: 'year is required' }, { status: 400 });
    }

    const closedBy = session.user?.id || session.user?.email || 'system';

    const result = await runYearEndClose(year, closedBy);

    return NextResponse.json({
      success: true,
      year,
      netIncome: result.netIncome,
      closingEntryId: result.closingEntryId,
      periodsCreated: result.periodsCreated,
    });
  } catch (error) {
    logger.error('Error running year-end close', { error: error instanceof Error ? error.message : String(error) });
    // #86 Error Recovery: Distinguish 400 (validation) from 500 (server) errors
    const rawMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
    const isValidationError = rawMessage.includes('not locked') ||
      rawMessage.includes('not found') ||
      rawMessage.includes('Only') ||
      rawMessage.includes('Cannot close');
    const message = isValidationError
      ? rawMessage
      : (process.env.NODE_ENV === 'development' ? rawMessage : 'Une erreur est survenue');
    return NextResponse.json(
      { error: message },
      { status: isValidationError ? 400 : 500 }
    );
  }
});

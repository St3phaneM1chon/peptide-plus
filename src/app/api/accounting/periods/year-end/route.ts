export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { runYearEndClose } from '@/lib/accounting/period-close.service';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const yearEndSchema = z.object({
  year: z.number().int().min(2000).max(2100),
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/periods/year-end');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = yearEndSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { year } = parsed.data;

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

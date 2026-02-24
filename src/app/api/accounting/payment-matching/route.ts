export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  findPaymentMatches,
  applyPaymentMatch,
  suggestUnmatchedPayments,
} from '@/lib/accounting/payment-matching.service';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------
const paymentMatchSchema = z.object({
  invoiceId: z.string().min(1, 'invoiceId is required'),
  bankTransactionId: z.string().min(1, 'bankTransactionId is required'),
});

/**
 * GET /api/accounting/payment-matching
 * Find payment matches for an invoice, or list all unmatched payment suggestions.
 *
 * Query params:
 *   - invoiceId: Find matches for a specific invoice
 *   - unmatched: If 'true', return all unmatched payment suggestions
 */
export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoiceId');
    const showUnmatched = searchParams.get('unmatched') === 'true';

    if (showUnmatched) {
      const suggestions = await suggestUnmatchedPayments();
      return NextResponse.json({
        count: suggestions.length,
        suggestions,
      });
    }

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Paramètre 'invoiceId' ou 'unmatched=true' requis" },
        { status: 400 },
      );
    }

    const matches = await findPaymentMatches(invoiceId);
    return NextResponse.json({
      invoiceId,
      matchCount: matches.length,
      matches,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    logger.error('[Payment Matching API] GET Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: `Erreur lors de la recherche de correspondances: ${message}` },
      { status: 500 },
    );
  }
});

/**
 * POST /api/accounting/payment-matching
 * Apply a payment match between an invoice and a bank transaction.
 *
 * Body: { invoiceId: string, bankTransactionId: string }
 */
export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/payment-matching');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = paymentMatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { invoiceId, bankTransactionId } = parsed.data;

    const userId = session?.user?.email || 'system';
    const result = await applyPaymentMatch(invoiceId, bankTransactionId, userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 },
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    logger.error('[Payment Matching API] POST Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: `Erreur lors de l'application du rapprochement: ${message}` },
      { status: 500 },
    );
  }
});

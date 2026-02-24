export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  getRecurringTemplates,
  createRecurringTemplate,
  processDueRecurringEntries,
  previewRecurringSchedule,
} from '@/lib/accounting';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const recurringLineSchema = z.object({
  accountCode: z.string().optional(),
  accountId: z.string().optional(),
  description: z.string().optional(),
  debitAmount: z.number().min(0).optional().default(0),
  creditAmount: z.number().min(0).optional().default(0),
}).passthrough();

const createRecurringSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(''),
  frequency: z.string().min(1),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
  monthOfYear: z.number().int().min(1).max(12).optional().nullable(),
  lines: z.array(recurringLineSchema).min(2, 'Au moins 2 lignes sont requises'),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  autoPost: z.boolean().optional().default(false),
  notifyOnCreate: z.boolean().optional().default(true),
});

/**
 * GET /api/accounting/recurring
 * List recurring entry templates.
 *
 * NOTE: The previous `?action=process` mutation-via-GET has been moved
 * to PUT /api/accounting/recurring for correctness (GET should be idempotent).
 */
export const GET = withAdminGuard(async () => {
  try {
    // List templates
    const templates = await getRecurringTemplates();

    return NextResponse.json({
      templates: templates.map((t) => ({
        ...t,
        nextSchedule: previewRecurringSchedule(t, 6).map((d) => d.toISOString().split('T')[0]),
      })),
    });
  } catch (error) {
    logger.error('Get recurring entries error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des écritures récurrentes' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/accounting/recurring
 * Create a new recurring entry template
 */
export const POST = withAdminGuard(async (request) => {
  try {
    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/recurring');
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
    const parsed = createRecurringSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const {
      name,
      description,
      frequency,
      dayOfMonth,
      dayOfWeek,
      monthOfYear,
      lines,
      startDate,
      endDate,
      autoPost,
      notifyOnCreate,
    } = parsed.data;

    // Validate balance
    const totalDebits = lines.reduce(
      (sum: number, l: { debitAmount?: number }) => sum + (Number(l.debitAmount) || 0),
      0
    );
    const totalCredits = lines.reduce(
      (sum: number, l: { creditAmount?: number }) => sum + (Number(l.creditAmount) || 0),
      0
    );

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return NextResponse.json(
        { error: "Le modèle n'est pas équilibré" },
        { status: 400 }
      );
    }

    const template = await createRecurringTemplate({
      name,
      description: description || '',
      frequency,
      dayOfMonth,
      dayOfWeek,
      monthOfYear,
      lines,
      startDate: new Date(startDate || Date.now()),
      endDate: endDate ? new Date(endDate) : undefined,
      nextRunDate: new Date(startDate || Date.now()),
      isActive: true,
      autoPost: autoPost ?? false,
      notifyOnCreate: notifyOnCreate ?? true,
    });

    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (error) {
    logger.error('Create recurring template error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la création du modèle récurrent' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/accounting/recurring
 * Process due recurring entries (previously was GET ?action=process).
 * Moved to PUT because it's a mutation operation.
 */
export const PUT = withAdminGuard(async (request) => {
  try {
    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/recurring');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const result = await processDueRecurringEntries();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Process recurring entries error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors du traitement des écritures récurrentes' },
      { status: 500 }
    );
  }
});

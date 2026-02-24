export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const budgetLineSchema = z.object({
  accountCode: z.string().min(1),
  accountName: z.string().min(1),
  type: z.string().optional().default('EXPENSE'),
  january: z.number().min(0).optional().default(0),
  february: z.number().min(0).optional().default(0),
  march: z.number().min(0).optional().default(0),
  april: z.number().min(0).optional().default(0),
  may: z.number().min(0).optional().default(0),
  june: z.number().min(0).optional().default(0),
  july: z.number().min(0).optional().default(0),
  august: z.number().min(0).optional().default(0),
  september: z.number().min(0).optional().default(0),
  october: z.number().min(0).optional().default(0),
  november: z.number().min(0).optional().default(0),
  december: z.number().min(0).optional().default(0),
});

const createBudgetSchema = z.object({
  name: z.string().min(1),
  year: z.number().int(),
  lines: z.array(budgetLineSchema).min(1),
});

const updateBudgetLineSchema = z.object({
  lineId: z.string().min(1),
  january: z.number().min(0).optional(),
  february: z.number().min(0).optional(),
  march: z.number().min(0).optional(),
  april: z.number().min(0).optional(),
  may: z.number().min(0).optional(),
  june: z.number().min(0).optional(),
  july: z.number().min(0).optional(),
  august: z.number().min(0).optional(),
  september: z.number().min(0).optional(),
  october: z.number().min(0).optional(),
  november: z.number().min(0).optional(),
  december: z.number().min(0).optional(),
});

/**
 * GET /api/accounting/budgets
 * List budgets with lines, optional year filter
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 200);

    const where: Record<string, unknown> = {};
    if (year) where.year = parseInt(year);

    const [budgets, total] = await Promise.all([
      prisma.budget.findMany({
        where,
        include: { lines: { orderBy: { accountCode: 'asc' } } },
        orderBy: { year: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.budget.count({ where }),
    ]);

    const mapped = budgets.map((b) => ({
      ...b,
      lines: b.lines.map((l) => ({
        ...l,
        january: Number(l.january),
        february: Number(l.february),
        march: Number(l.march),
        april: Number(l.april),
        may: Number(l.may),
        june: Number(l.june),
        july: Number(l.july),
        august: Number(l.august),
        september: Number(l.september),
        october: Number(l.october),
        november: Number(l.november),
        december: Number(l.december),
        total: Number(l.total),
      })),
    }));

    return NextResponse.json({
      budgets: mapped,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('Get budgets error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des budgets' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/accounting/budgets
 * Create a new budget with lines
 */
export const POST = withAdminGuard(async (request) => {
  try {
    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/budgets');
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
    const parsed = createBudgetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { name, year, lines } = parsed.data;

    // #63 Audit: Validate year is reasonable
    const currentYear = new Date().getFullYear();
    if (year < currentYear - 5 || year > currentYear + 5) {
      return NextResponse.json(
        { error: `Budget year ${year} is out of reasonable range (${currentYear - 5} to ${currentYear + 5})` },
        { status: 400 }
      );
    }

    const budget = await prisma.budget.create({
      data: {
        name,
        year,
        lines: {
          create: lines.map((l: {
            accountCode: string;
            accountName: string;
            type?: string;
            january?: number;
            february?: number;
            march?: number;
            april?: number;
            may?: number;
            june?: number;
            july?: number;
            august?: number;
            september?: number;
            october?: number;
            november?: number;
            december?: number;
          }) => {
            const jan = l.january || 0;
            const feb = l.february || 0;
            const mar = l.march || 0;
            const apr = l.april || 0;
            const may = l.may || 0;
            const jun = l.june || 0;
            const jul = l.july || 0;
            const aug = l.august || 0;
            const sep = l.september || 0;
            const oct = l.october || 0;
            const nov = l.november || 0;
            const dec = l.december || 0;
            const total = jan + feb + mar + apr + may + jun + jul + aug + sep + oct + nov + dec;

            return {
              accountCode: l.accountCode,
              accountName: l.accountName,
              type: l.type || 'EXPENSE',
              january: jan,
              february: feb,
              march: mar,
              april: apr,
              may: may,
              june: jun,
              july: jul,
              august: aug,
              september: sep,
              october: oct,
              november: nov,
              december: dec,
              total,
            };
          }),
        },
      },
      include: { lines: true },
    });

    return NextResponse.json({ success: true, budget }, { status: 201 });
  } catch (error) {
    logger.error('Create budget error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la création du budget' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/accounting/budgets
 * Update a budget line
 */
export const PUT = withAdminGuard(async (request, { session }) => {
  try {
    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/budgets');
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
    const parsed = updateBudgetLineSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { lineId, ...months } = parsed.data;

    const existing = await prisma.budgetLine.findUnique({ where: { id: lineId } });
    if (!existing) {
      return NextResponse.json({ error: 'Ligne budgétaire non trouvée' }, { status: 404 });
    }

    const monthFields = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december',
    ];

    const updateData: Record<string, unknown> = {};
    for (const m of monthFields) {
      if (months[m] !== undefined) {
        const val = Number(months[m]);
        if (isNaN(val) || val < 0) {
          return NextResponse.json(
            { error: `Valeur invalide pour ${m}: doit être un nombre positif ou zéro` },
            { status: 400 }
          );
        }
        updateData[m] = val;
      }
    }

    // Recalculate total
    const merged = { ...existing, ...updateData };
    const total = monthFields.reduce((s, m) => s + Number(merged[m as keyof typeof merged] || 0), 0);
    updateData.total = total;

    const line = await prisma.budgetLine.update({
      where: { id: lineId },
      data: updateData,
    });

    // #79 Compliance: Audit logging for budget modifications
    logger.info('AUDIT: Budget line updated', {
      budgetLineId: lineId,
      budgetId: existing.budgetId,
      accountCode: existing.accountCode,
      modifiedBy: session.user.id || session.user.email,
      modifiedAt: new Date().toISOString(),
      previousTotal: Number(existing.total),
      newTotal: total,
      changedMonths: Object.keys(updateData).filter(k => k !== 'total'),
    });

    return NextResponse.json({ success: true, line });
  } catch (error) {
    logger.error('Update budget line error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la ligne budgétaire' },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/accounting/budgets
 * Delete a budget and its lines
 */
export const DELETE = withAdminGuard(async (request, { session }) => {
  try {
    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/budgets');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.budget.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Budget non trouvé' }, { status: 404 });
    }

    // #44 Soft-delete: preserve budget for audit trail instead of hard delete
    if (existing.isActive === false) {
      return NextResponse.json(
        { error: 'Ce budget est déjà désactivé' },
        { status: 400 }
      );
    }

    await prisma.budget.update({
      where: { id },
      data: { isActive: false },
    });

    // #79 Compliance: Audit logging for budget soft-delete
    logger.info('AUDIT: Budget soft-deleted', {
      budgetId: id,
      budgetName: existing.name,
      budgetYear: existing.year,
      deletedBy: session.user.id || session.user.email,
      deletedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: 'Budget désactivé' });
  } catch (error) {
    logger.error('Delete budget error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du budget' },
      { status: 500 }
    );
  }
});
